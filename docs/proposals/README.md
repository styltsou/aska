# Proposals

Architecture proposals and design directions that are **not implemented**, or
only partly implemented. The rest of `docs/` describes the system as it exists
today; this folder describes where it might go.

Rules for this folder:

- Every proposal starts with a status line: `Proposed`, `Accepted`,
  `In progress`, `Implemented`, or `Rejected`.
- A proposal may link to the maintained docs. The maintained docs should not
  describe proposed behavior as if it exists.
- When a proposal ships, move its lasting decisions and invariants into the
  relevant maintained doc, then mark the proposal `Implemented` (or delete it).
  Do not leave the proposal as the only description of shipped behavior.

## Index

- [Unified Media and Note Images](./unified-media-and-note-images.md) — one
  media record for every stored image, note-owned image uploads that survive
  autosave, and a path to semantic indexing.
- [YouTube Video Link Detail](./youtube-video-link-detail.md) — a modal or
  bottom-sheet viewer for resolved YouTube links, with a personal link note.
- [Node Delete API](./collection-node-delete-api.md) — one kind-agnostic delete
  for folders, images, and notes on a collection canvas.
- [Collection-Node Move Follow-up](./collection-node-move-in-place.md) — update
  asset placement rows in place so moves keep their membership timestamp.
