# Note Agent

The note agent writes new content at the cursor, rewrites selected text, runs
quick actions, and uses mentioned notes, links, colors and images as context. The UI still labels it
"AI" (**Ask AI**); code and docs call it the agent, while deploy names
(`aiApi`, `ai-stream-lambda`, `/api/ai/stream`, `VITE_AI_STREAM_URL`) keep
"ai". This document
covers how it works end to end, the invariants that keep it predictable, and
what is planned next.

## What users can do

| Entry point | Result |
| --- | --- |
| Space on an empty line | Prompt opens on that line; the agent writes new content there. |
| Select text, then **Ask AI** in the selection toolbar or Ctrl/Cmd+J | Prompt opens under the selection; the agent rewrites just the selected text. |
| Quick-action chips under an empty prompt | Preset instructions: continue writing, summarize, outline, action items; or improve, fix grammar, shorter, longer for a selection. |
| `@` in the prompt | Picks notes whose content is sent as context. |

Every run goes through the same three states:

1. **Prompt:** a one-line input in the note, at the place the result will go.
   The placeholder teaches `@` ("…, @ to mention…").
2. **Streaming:** "Writing…" with Stop (Esc), preceded by status steps such as
   "Searching this note…" when the agent looks something up. Output goes straight into the note
   as it arrives; each new chunk fades in over 100ms. There is no artificial
   pacing.
3. **Review:** the result sits in the note as a **pending draft**, marked by a
   rail in the left gutter. Actions: Retry, Discard (Esc), Keep (Enter on an
   empty follow-up). A follow-up input stays under the actions; each follow-up
   rewrites the whole draft.

Clicking away keeps the draft. A rewrite in review shows a word-level diff
against the original text: added text tinted, removed text struck through in
place.

## Architecture

```
NoteRichText (Tiptap editor)
 ├─ NoteAgentSession plugin ── pending range, original content, decorations, locks
 └─ NoteAgentPrompt (portaled into a widget decoration after the range)
      ├─ note-agent-mentions ── @ picker → mention-search API; mentions sent as IDs
      └─ streamNoteAgent ── POST /api/ai/stream (SSE)
                              │
                 ai-stream-lambda (AWS Lambda, response streaming)
                   auth (Better Auth session cookie) → zod request schema
                              │
                 note-agent (overview + read/search tools, ≤4 rounds)
                   prompt parts → createNoteModel() → Gemini ⇄ tools
                              │
                 SSE: custom {status | delta | done}, error {message}
```

### Client (`client/src/components/board/note-editor/agent/`)

**`note-agent-session.ts`: the session plugin.** A ProseMirror plugin owns one
session at a time. Its state:

| Field | Meaning |
| --- | --- |
| `range` | The top-level blocks the agent owns. Mapped through every transaction (`from` with assoc 1, `to` with assoc -1, so edits at the edges stay outside). |
| `original` | What the session replaced: `null` for an empty line, or the selected blocks for a rewrite. |
| `passage` | For a rewrite, the selected blocks as Markdown with `⟦selection⟧…⟦/selection⟧` around the exact selection (omitted when whole blocks are selected). |
| `target` | For a rewrite, the selected text, highlighted while the instruction is typed (focus is in the prompt, so the native selection doesn't show). |
| `streaming`, `fresh` | Whether a run is writing, and where the latest chunk starts (drives the fade). |
| `diff` | For a rewrite in review, what the draft changes compared with `original`. |
| `widget` | The DOM element the prompt renders into. |

Rules the plugin enforces:

- **Content changes skip history.** Streaming replaces the range with
  `addToHistory: false`. **Keep** restores the original outside history, then
  inserts the final content in one history step after `closeHistory`, so a
  single undo returns to exactly what was there before. **Discard** restores the
  original and leaves no trace in the undo stack.
- **The draft is locked.** Typing, pasting and dropping into the range are
  swallowed. The drag handle and the formatting bubble menu are hidden over
  pending blocks (`isInNoteAgentDraft`, `selectionOverlapsNoteAgentDraft`). Clicking
  into the draft blurs the prompt, which keeps it; after that it is normal text.
- **Saving excludes the draft.** `noteMarkdownWithoutAgentDraft` swaps the range
  back to `original` for autosave, so a pending draft is never persisted as note
  content.
- **Markdown in, nodes out.** `setNoteAgentContent` re-parses the accumulated
  Markdown on every update (partial Markdown included), strips any markers the
  model echoed, and computes `fresh` with `Fragment.findDiffStart`.

**`note-agent-prompt.tsx`: the prompt component.** Owns the phase
(`prompt` / `streaming` / `review`), the input, quick actions, the action row,
focus hand-offs, and the request lifecycle:

- Context is captured once when the prompt opens:
  `noteMarkdownAtAgentCursor` serializes the note with `⟦cursor⟧` in place of the
  range. The whole note is sent (up to 200,000 characters); the server decides
  how much the model sees.
- Follow-ups send the current draft plus `earlierPrompts` (the instructions
  that produced it, oldest first, at most 10).
- For a rewrite, the model returns only the replacement for the selected part;
  `noteAgentPassageWith` rebuilds the passage around it, so text outside the
  selection can't be dropped or altered. Selections that cut a word are widened
  to whole words at start.
- Output is written on the next animation frame after each chunk; nothing is
  delayed beyond that.
- Escape is handled in the window capture phase so the surrounding note drawer
  never reads it as "close": it closes the `@` picker, stops streaming, or
  discards.
- Blur: during streaming the draft is kept once the stream ends; in review it
  is kept; an unused prompt is discarded. Window switches are ignored.

**`note-agent-stream.ts`: transport.** A fetch-based SSE reader with an
`AbortController` (it replaced `@langchain/langgraph-sdk`'s `useStream`, which
delivered events twice). Posts `{ input: request }` with credentials to
`VITE_AI_STREAM_URL` (normalized to `/api/ai/stream`) or the API origin.

**`note-agent-diff.ts`: word diff.** Tokenizes both versions into words, spaces,
block boundaries and atom blocks, diffs them with `diff`'s `diffArrays`, and
groups changes into hunks (a run of changes plus the blank space between them).
Output is positions for decorations: inline highlights for added text, widgets
for removed text (a whole removed block renders on its own line), node
decorations for added atoms. Formatting-only changes are not shown.

**`note-agent-mentions.tsx`: `@` mentions.** Detects `@query` before the caret,
searches with the editor's existing `mentionSearchQueryOptions` (notes, links,
colors and images: `AGENT_MENTION_TYPES`), shows picked items as chips with the
editor's mention glyphs (at most 3), and sends their IDs with each request
(`workspaceSlug` plus `mentions: [{ assetId, type }]`). The server loads the
content, fresh per request, so follow-ups see edits.

**`note-agent-draft-store.ts`: persistence.** A finished draft on an empty line is
stored in `localStorage` (`aska:note-ai-draft:v1:{noteId}`, 14-day expiry) and
restored after a refresh only if the note's draft-less Markdown is unchanged.
Restored drafts don't take focus. Rewrites are not stored.

**Editor integration (`note-rich-text.tsx`):** the space trigger, Ctrl/Cmd+J,
the **Ask AI** toolbar button, portaling the prompt into the widget, autosave
deduplication during a session, draft restore, and the empty-line placeholder
("Press space for AI or '/' for blocks…").

**Styling (`note-rich-text.css`):** the rail is measured in JS
(`usePendingRail`) rather than drawn per block, so it stays continuous and isn't
clipped by blocks with hidden overflow (tables, code blocks). The chunk fade is
opacity-only, 100ms, `cubic-bezier(0.23, 1, 0.32, 1)`. Diff colors use the rail
blue for additions and a muted strike with a destructive-tinted line for
removals.

### Server (`server/src/`)

**`ai-stream-lambda.ts`.** A streaming Lambda behind its own API Gateway REST
API (`aiApi`, route `ANY /stream`, 2-minute timeout, see `sst.config.ts`). It
checks the origin against `CORS_ORIGINS`, resolves the Better Auth session from
the cookie, validates the body, then streams the agent's output as SSE:

| Event | Payload |
| --- | --- |
| `custom` | `{ type: "status", text }` for each lookup, `{ type: "delta", text }` for each chunk of the answer, then `{ type: "done" }` |
| `error` | `{ message }`, readable as-is (see `agent/agent-error.ts`) |

Request schema and limits:

| Field | Limit | Purpose |
| --- | --- | --- |
| `prompt` | 1–4,000 chars | The instruction. |
| `note` | 200,000 chars | The whole note with `⟦cursor⟧`. |
| `task` | `write`, `rewrite`, `mechanical` | Optional; mechanical edits (fix grammar, shorter, longer) never look anything up. Defaults from `passage`. |
| `draft` | 40,000 chars | The draft (or replacement) a follow-up revises. |
| `earlierPrompts` | 10 × 4,000 | Instructions behind `draft`. |
| `passage` | 40,000 chars | Rewrite only: the blocks with the selection marked. |
| `workspaceSlug` | 200 chars | Required with `mentions`: the workspace they belong to. |
| `mentions` | 3 × `{ assetId, type }` | `@`-mentioned notes, links, colors and images, loaded on the server by `agent/mentioned-assets.ts`. `type` defaults to `note` (requests saved before types existed). |

**`agent/note-agent.ts`.** The note agent as a small loop
(model → tools → model), following
[Agent Context and Tools](./proposals/agent-context.md):

- **Overview** (`agent/note-context.ts`): a note up to 6,000 characters is shown
  whole; a longer one as an outline (headings, line ranges, sizes) plus the
  excerpt around the cursor. Mentioned items arrive as text (`<referenced-note>`,
  `<referenced-link>`, `<referenced-color>`, `<referenced-image>`): whole when
  small, else as a card (outline and beginning); in practice only long notes
  become cards. Attached images follow the text in the same user message, each
  labeled with its reference id (`userMessage`).
- **Tools**, attached only for what isn't fully shown: `read_note_section`,
  `search_note`, `read_reference`, `search_reference`. They read the request's
  own text, so no database is involved; results are numbered lines, capped.
- **Fast path:** mechanical edits, and requests where everything is already in
  view, get no tools and a single streaming call.
- **Answer only:** text at the start of a round is held back until it's clearly
  not a preamble to a tool call, so only the final answer reaches the note. At
  most 4 tool rounds, then the model is told to answer.
- **Prompts** (`agent/note-prompts.ts`): a shared base, one task part (write,
  rewrite, mechanical), a references part when items are mentioned, and the
  context-and-tools part only when tools are attached.

**`agent/note-graph.ts`.** The previous single-call LangGraph pipeline, kept as
the eval baseline (`--pipeline baseline`).

**`agent/note-model.ts`.** `createNoteModel()` is the only code that knows the
provider (Gemini `gemini-2.5-flash`, `maxRetries: 1` so usage-limit errors
surface quickly). Everything downstream accepts any LangChain chat model, so
switching providers means changing this function and its secret.

**`agent/agent-error.ts`.** Maps provider failures to user-facing messages by status
and wording: 429 / quota → "AI usage limit reached", 503 / 529 / overloaded →
"model is overloaded", otherwise "AI generation failed".

## Invariants

- A pending draft is never note content until kept: not saved, not in history,
  not editable, not draggable.
- Keep is exactly one undo step; Discard leaves nothing behind.
- Diffs and removed text are decorations, never document content.
- For rewrites the model writes only the replacement; the client owns
  everything around it.
- Output is shown as it arrives. Visual smoothing is limited to a short fade on
  new content; there is no typewriter pacing.
- Unaccepted drafts are not diffed against earlier drafts: a follow-up replaces
  the draft as a whole, as in other editors.

## Testing

- Client unit tests live next to the modules: `note-agent-session.test.ts` (a
  ProseMirror harness with history, since headless Tiptap registers no plugins),
  `note-agent-diff.test.ts`, `note-agent-stream.test.ts`,
  `note-agent-draft-store.test.ts`, `note-agent-mentions.test.ts`.
- Server: `agent/note-agent.test.ts` (overview, tools, fast path, round limit),
  `agent/note-graph.test.ts`, `agent/agent-error.test.ts` and `agent/eval/eval.test.ts`.
  Run them with `bun run test:agent` (vitest under the Bun runtime fails to
  import `zod`; `bun test` runs the same files).
  `agent/mentioned-assets.test.ts` covers the text links and colors become;
  `agent/mentioned-assets.integration.test.ts` checks mention loading, type
  matching and workspace access against a database (`bun run test:integration`). `agent/eval/scripted-model.ts` plays
  back scripted tool calls and answers for tests.
- Eval: `bun run agent:eval` in `server/` (`--fake` for a free scripted run,
  `--pipeline baseline` to compare, `--delay` for rate limits).
- In the browser, stub `window.fetch` for URLs containing `/ai/` to return a
  scripted SSE stream. This exercises the whole client without model calls.
  Back up the note first (for example in `sessionStorage`) and avoid editing
  source files mid-test: a hot reload remounts the prompt, and the blur keeps
  the draft.
- Local clients use the deployed agent stream, so server changes only show up after
  `main` is deployed.

## Design decisions

Each entry records what was decided, why, and what would make us revisit it.
The aim is the simplest design that stays correct; add machinery only when a
concrete need shows up.

**The client sends the whole current note; the server decides what the model
sees.** The request carries the note with `⟦cursor⟧` (up to 200,000
characters), but the model gets the whole note only when it is short (6,000
characters or less); otherwise an outline plus the text around the cursor, and
tools for the rest. Upload size is the only cost; tokens are controlled on the
server. The client sends the note because the server's copy can be behind what
the user sees: autosave runs on a delay, a pending draft is never saved, and
the cursor is a position in the editor's text, which is wrong against an older
saved version. *Revisit with persistence:* the client sends `noteId`, the
saved version it is based on, and the cursor; the server loads the note when
the version matches, and the client sends the note (or its unsaved changes)
only when it doesn't. Don't build a separate version check before that.

**Mentions travel as IDs and are loaded on the server.** The request carries
`workspaceSlug` and `mentions: [{ assetId, type }]`; one query loads them and
checks workspace membership, so the agent can only read what the user could
open, and the client can't pass off arbitrary text as a mentioned item.
Missing or inaccessible items, and a `type` that doesn't match the asset, are
dropped without an error. Each type becomes text in `referenceFromRow`
(`agent/mentioned-assets.ts`); a new type adds a join and a case there.

**A mentioned link is its stored details, not its page.** Only the unfurled
title, URL, site, kind and description (plus the user's note on it) are
stored, so that is what the agent gets, and the prompt tells it not to claim
more about the page. *Revisit* if users ask about page contents: fetching the
page at request time adds latency and failure modes, so prefer storing
extracted text at unfurl time and reading it like a note.

**Colors are labeled values.** Name, hex, gradient stops and the user's note;
the agent is told to use them as given.

**Images are described, and attached when possible.** Every mentioned image
becomes text (title, alt text, size, source, dominant colors, the user's note).
Up to 2 per request also attach their pixels: the stored display variant
(about 960px wide), else the preview, else the original, only in formats the
model reads (PNG, JPEG, WebP, HEIC) and up to 4 MB, read from S3 by the stream
Lambda. A failed fetch leaves the text description, never fails the request,
and the agent is told not to invent what an image shows from details alone.
Cost is a few hundred tokens per attached image at that size; *revisit* the
limit of 2, or a smaller variant, if usage grows.

**The rest of a request still comes from the client:** the prompt, the passage
for rewrites, and for follow-ups the previous draft and earlier prompts. Drafts
live only in the client (and `localStorage`) until persistence stores them on
the server.

**The agent is a plain loop, not a graph.** Model → tools → model, at most 4
tool rounds. It needs exact control over which text reaches the note (a
preamble before a tool call is held back and dropped), which a plain loop gives
directly. The LangGraph single-call pipeline remains only as the eval baseline.

**No router call before the model.** Rules decide when to attach tools
(mechanical edits and fully visible content get none); otherwise the model
decides in the same call. A separate classification call would slow every
request, including the ones that need nothing.

**Exact search before embeddings.** Tools read and grep text. Workspace search
starts with Postgres full-text search; embeddings come only if evals show
keyword search missing obvious matches.

**Real evals run in batches.** The free-tier token budget is small, so real
runs wait until several features are in and run once over a larger case set.
Each feature adds fake-mode cases (scripted lookups that run the real tools) as
it lands, so the harness and tools stay tested in the meantime.

**Naming.** Code and docs call it the agent; the UI still says "AI" (**Ask
AI**). Deploy names (`aiApi`, `ai-stream-lambda`, `/api/ai/stream`,
`VITE_AI_STREAM_URL`) and the saved-draft `localStorage` key keep "ai", since
renaming them would change URLs or drop saved drafts.

## Planned and possible next steps

The next step is designed in
[Agent Context and Tools](./proposals/agent-context.md): an overview plus tools
the model calls to read and search the note and mentioned assets, a fast path
with no tools for simple edits, prompts built from parts per task, and an eval
harness (`bun run agent:eval` in `server/`) to compare pipelines.

**Hidden image descriptions (with workspace search).** An image's title can
be a file name or an unrelated label, so the agent is told to trust the
attached image over it. For search, and for images that aren't attached
(more than 2, or a failed fetch), store a description in its own column, never
shown to users: taken from the source when it has one (Pexels), otherwise
generated once by a vision model in the image pipeline after variants exist.
Backfill existing images slowly, given the token budget. Mentions keep
attaching the image itself.

**Mention videos.** Notes, links, colors and images work today. Videos need
title and note first, then a transcript once one exists (or a poster frame as
an image). They add a type to `AGENT_MENTION_TYPES` / `MENTIONABLE_TYPES` and
a case in `referenceFromRow`.

**Edit-based output for long drafts.** Follow-ups and rewrites return full text.
For long drafts, search-and-replace edits would save tokens and latency; they
need validation and a fallback to full rewrite when an edit doesn't apply.

**Optional "show changes" for follow-ups.** A toggle that diffs a follow-up
against the previous draft, for targeted changes to long drafts. The diff
engine already supports it.

**Persistence.**

- Store drafts server-side so they follow the user across devices.
- Send `noteId` + saved version + cursor instead of the whole note (see
  Design decisions).
- Restore pending rewrites after a refresh, which needs the original and the
  selection stored alongside.

**Streaming polish.** While a table streams, its header row shows as raw pipes
until the delimiter row arrives; a trailing incomplete table line could be held
back until the next chunk.

**Context quality.** Workspace-wide search (`search_workspace`) once there is
a concrete need, and a "Sources" line under the draft showing what the agent
read.

**Operations.**

- Per-user usage limits and visibility into cost.
- Provider and model chosen through configuration.
- Run the server agent tests under Node in CI.
- Remove the now-unused `@langchain/langgraph-sdk` dependency from the client.

**Interaction ideas.**

- User-defined quick actions.
- `/` commands in the prompt.
- Screen-reader announcements for streaming and for the diff in review.
