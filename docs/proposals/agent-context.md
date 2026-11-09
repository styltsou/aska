# Note Agent: Context and Tools — Design Note

**Status:** In progress. Built: the eval harness (`server/src/agent/eval/`) and
step 2 below (the agent loop, `server/src/agent/note-agent.ts`), and
mentioned notes loaded on the server by ID. Not built: other asset types,
workspace search. The current pipeline is described in
[Note Agent](../note-agent.md).

## Problem

Today the agent sees a fixed window of context:

- the current note, trimmed to 38,000 characters around the cursor;
- mentioned notes, each cut at 12,000 characters.

Anything outside those windows is invisible: a decision near the top of a long
note, a detail at the end of a large mentioned note. Sending everything instead
is slow and costly, and doesn't extend to images or to search across the
workspace.

## Approach

Give the model a **cheap overview plus tools to look closer**, the pattern used
by coding agents and AI assistants:

- Claude Code reads files with ranged reads and finds things with grep and
  glob, rather than a vector index.
- Cursor combines an embeddings index with grep and file reads.
- Retrieval products search chunked documents by keyword and embedding together
  and rerank the results.

Exact search (grep, full-text) gives precise recall for names and phrases;
vector search covers meaning when the words differ. We start with exact search
and add vectors only if evals show a need.

The graph becomes a loop: a model node that may call tools, a tool node, and
back, until the model writes its answer. Requests that need no lookup take a
fast path with no tools at all.

## Context layers

| Layer | Always included? | Contents |
| --- | --- | --- |
| Overview | Yes | The current note's outline (headings with approximate sizes), the text around the cursor or the passage being rewritten. |
| Mention cards | When there are mentions | Per mentioned asset: type, title, size, outline or first lines. Never the full body. |
| Tool results | On demand | Whatever the model reads or searches, each result capped. |

Short notes (under roughly 6,000 characters) are included whole instead of an
outline, and short mentioned notes the same way, since a lookup would cost more
than the text.

## Tools

| Tool | Arguments | Returns | Cap |
| --- | --- | --- | --- |
| `read_note_section` | `heading` or `{ from, to }` line range | That part of the current note | 8,000 chars |
| `search_note` | `pattern` (plain text or regex) | Matching lines with line numbers and a little surrounding context | 20 matches |
| `read_asset` | `assetId`, optional `heading` or line range | Part of a mentioned asset; for an image, the image itself | 8,000 chars, one image |
| `search_asset` | `assetId`, `pattern` | Matching lines in a mentioned asset | 20 matches |
| `search_workspace` (later) | `query` | Ranked notes and links with a snippet each | 10 results |

`search_workspace` starts as Postgres full-text search, ranked by keyword
relevance (close to BM25), with trigram matching for typos. Embeddings
(pgvector) and merged result lists come later, only if evals show keyword search
missing obvious matches.

Current-note tools run on the note text the client already sends, so they need
no database. Asset tools resolve IDs on the server, which also enforces access
and size limits in one place (this replaced the earlier client-side fetch).

## Deciding whether to look anything up

No separate router call: it would add latency to every request, including the
ones that need nothing.

1. **Rules before any model call.** No tools are attached, so the request is a
   single streaming call as today, when:
   - the task is a mechanical edit (fix grammar, shorter, longer, translate);
   - or there are no mentions and the whole note fits in the overview.
2. **Otherwise the model decides in the same call.** With tools attached, the
   model either starts writing (streamed immediately, no extra cost) or asks for
   a tool. The context-and-tools prompt part says to look things up only when
   the answer depends on content it doesn't have.
3. **Limits.** At most 4 tool rounds and about 15 seconds of tool time, then the
   model must answer with what it has.

## Prompts

Built from parts rather than one prompt per task:

| Part | Used by | Says |
| --- | --- | --- |
| Base | Every task | Markdown and format rules, the note's conventions, no fake mentions. |
| Write | Space on an empty line | Generate new content for the cursor that fits its surroundings. |
| Rewrite | Selection, open-ended instruction | Return only the replacement for the marked part, inline within a sentence. |
| Mechanical edit | Fix grammar, shorter, longer, translate | Stricter rewrite: keep meaning and formatting, change nothing beyond the task. |
| Context and tools | Only when tools are attached | How to use the overview and mention cards, when to search, how to cite what was read. |

The entry point already tells us the task, so no classification is needed.
Settings can differ per task: lower temperature for mechanical edits, and
possibly a faster model for them.

## Streaming and UX

- Tool steps stream as status events (`custom { type: "status", text }`), shown
  in place of "Writing…": "Reading Roadmap…", "Searching this note…".
- Only the final answer streams into the note.
- Stop cancels at any point, including mid-tool.

## Evaluation

`server/src/agent/eval/` holds fixed cases and a runner that drives a pipeline and
prints, per case: pass/fail of simple checks, time to first text, total time,
output length, and tool calls. Cases cover:

- plain writing that needs no context (should never use tools);
- a mechanical rewrite (must stay close to the original);
- a fact far up a long note, outside the current window;
- a detail at the end of a large mentioned note, past the current cap;
- a question that needs two mentioned notes.

The current pipeline is the baseline, run with the same trimming and caps the
client applies, so the far-away cases are expected to fail today. Routing is
measured as unneeded tool calls (plain cases) and missed lookups (context
cases).

Run it from `server/`:

```bash
bun run agent:eval -- --fake
```

```bash
GOOGLE_GENERATIVE_AI_API_KEY=... bun run agent:eval
```

`--fake` uses a scripted model (no key, no cost) to check the harness itself.
`--case <id>` runs one case; `--verbose` prints full outputs.

## Rollout

1. Spec and eval harness. *(done; the real baseline run was skipped to save
   tokens, since its far-away cases fail by construction)*
2. Agent loop with current-note and mentioned-note tools, status events, the
   fast path, and prompt parts. *(done; passes all cases with a scripted
   model, real run pending)*
3. Mentions resolved on the server by ID, with the workspace access check.
   *(done for notes: `server/src/agent/mentioned-notes.ts`)* Then other
   asset types through `read_asset`: links (unfurled text), images
   (vision), colors, then videos once transcripts exist.
4. `search_workspace` on Postgres full-text search.
5. Embeddings, only if the evals ask for them.

Persistence (server-side drafts, indexing on save) is designed separately,
after this.

## Open questions

- Whether a faster model is good enough for mechanical edits, or quality drops.
- How to show what the agent read: a "Sources" line under the draft, or only the
  status steps.
- Per-user limits on tool rounds and tokens once usage grows.
