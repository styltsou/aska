# Note Agent

The note agent writes new content at the cursor, rewrites selected text, runs
quick actions, and uses mentioned notes as context. The UI still labels it
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
      ├─ note-agent-mentions ── @ picker → mention-search API, note content fetch
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
searches with the editor's existing `mentionSearchQueryOptions` (notes only),
shows picked notes as chips (at most 3), and on each request fetches their
content with `fetchPeekableAsset` (`note-{id}`), capped at 100,000 characters
each. Content is read fresh per request, so follow-ups see edits.

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
| `referencedNotes` | 3 × (300 title, 100,000 Markdown) | `@`-mentioned notes, whole. |

**`agent/note-agent.ts`.** The note agent as a small loop
(model → tools → model), following
[Agent Context and Tools](./proposals/agent-context.md):

- **Overview** (`agent/note-context.ts`): a note up to 6,000 characters is shown
  whole; a longer one as an outline (headings, line ranges, sizes) plus the
  excerpt around the cursor. Mentioned notes are shown whole when small, else
  as a card (outline and beginning).
- **Tools**, attached only for what isn't fully shown: `read_note_section`,
  `search_note`, `read_reference`, `search_reference`. They read the request's
  own text, so no database is involved; results are numbered lines, capped.
- **Fast path:** mechanical edits, and requests where everything is already in
  view, get no tools and a single streaming call.
- **Answer only:** text at the start of a round is held back until it's clearly
  not a preamble to a tool call, so only the final answer reaches the note. At
  most 4 tool rounds, then the model is told to answer.
- **Prompts** (`agent/note-prompts.ts`): a shared base, one task part (write,
  rewrite, mechanical), a references part when notes are mentioned, and the
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
  Run them with `bun test src/ai` (vitest under the Bun runtime fails to import
  `zod`; `bun test` runs the same files). `agent/eval/scripted-model.ts` plays
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

## Planned and possible next steps

The next step is designed in
[Agent Context and Tools](./proposals/agent-context.md): an overview plus tools
the model calls to read and search the note and mentioned assets, a fast path
with no tools for simple edits, prompts built from parts per task, and an eval
harness (`bun run agent:eval` in `server/`) to compare pipelines.

**Mention any asset, not just notes.** The picker, chips, request field and
prompt are note-specific today. The plan is a per-type context builder:

- links: title, URL and unfurled description or page text;
- images: the image itself for a vision-capable model, or its caption and
  colors;
- colors: name and value;
- videos: title, plus a transcript once available.

The request would carry typed references (`{ type, title, … }`) and the
placeholder already reads "@ to mention" with no object.

**Resolve mentioned assets on the server.** The client currently fetches and
sends mentioned content. Resolving IDs server-side would cut payload size, let
the server enforce access and size limits in one place, and is needed anyway for
binary assets like images.

**Edit-based output for long drafts.** Follow-ups and rewrites return full text.
For long drafts, search-and-replace edits would save tokens and latency; they
need validation and a fallback to full rewrite when an edit doesn't apply.

**Optional "show changes" for follow-ups.** A toggle that diffs a follow-up
against the previous draft, for targeted changes to long drafts. The diff
engine already supports it.

**Persistence.**

- Store drafts server-side so they follow the user across devices.
- Restore pending rewrites after a refresh, which needs the original and the
  selection stored alongside.

**Streaming polish.** While a table streams, its header row shows as raw pipes
until the delimiter row arrives; a trailing incomplete table line could be held
back until the next chunk.

**Context quality.** Smarter handling of very long notes than a fixed window
around the cursor (for example a summary of the rest), and optionally
workspace-wide retrieval once there is a concrete need.

**Operations.**

- Per-user usage limits and visibility into cost.
- Provider and model chosen through configuration.
- Run the server agent tests under Node in CI.
- Remove the now-unused `@langchain/langgraph-sdk` dependency from the client.

**Interaction ideas.**

- User-defined quick actions.
- `/` commands in the prompt.
- Screen-reader announcements for streaming and for the diff in review.
