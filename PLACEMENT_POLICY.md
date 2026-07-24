# Canvas Placement Policy

Every creation or move resolves one placement context, then uses the same
card-footprint and 32-pixel-gutter collision rules. Positions are persisted on
collection nodes; viewports are local browser state and are never a shared
source of truth.

## Placement contexts

| Context | Anchor | Search area | When no free slot exists |
|---|---|---|---|
| Canvas context menu | Captured flow-space click | None | Keep the requested coordinate; resolve a local collision only when needed. |
| Direct file drop | Actual flow-space drop event | None | Keep the requested coordinate; resolve a local collision only when needed. |
| Canvas paste | Last pointer position observed on that canvas | None | Use the paste anchor with normal local collision handling. |
| Header, command palette, and note extraction | Resolved when the creation action is confirmed | Current viewport | Use the viewport centre, even if it overlaps. |
| Move into a folder | Resolved by the server in the move transaction | Destination composition bounds | Use the composition centre, even if it overlaps. |

The last pointer is deliberately a paste-only signal. It must not be used as a
fallback for direct drops, dialogs, or command-palette actions.

## Batches

Multi-image insertions start from their resolved anchor and use a fresh
four-column grid. The horizontal and vertical gutter is the canvas-wide
32 pixels. A row advances by the tallest card in its row plus that gutter, so
portrait images never overlap the next row. Batch state is not remembered
between actions.

An explicit anchor may produce cards beyond the current viewport. For a
viewport-based action, only the anchor must be visible; the rest of a large
batch may extend beyond it.

## Folder moves

A drop onto a folder has spatial intent in the source canvas, not in the
destination canvas. The source pointer coordinate is therefore never copied
into the folder.

The move service reads the destination folder's positioned direct children in
the same transaction that performs the move. Their card footprints define a
composition bounding box. The moved card searches centre-outward for a
collision-free position wholly inside that box. If the folder is empty, the
card starts at `(48, 48)`. If no free position exists inside the composition,
the card is persisted at the composition centre rather than placed at an
unrelated, distant coordinate.

The destination folder row is locked by the existing move transaction, which
serializes concurrent moves into that folder. A direct-child index supports the
geometry lookup.

## Legacy and unavailable context

Legacy rows that do not yet have persisted coordinates still render through a
deterministic fallback grid. It is a compatibility path, not a placement
policy for normal creation or moves.
