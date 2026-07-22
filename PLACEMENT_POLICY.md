# Canvas Placement Policy

## Two placement modes

All node placement on the canvas falls into one of two modes depending on
whether the anchor point is chosen by the user or by the system.

| Mode | Anchor source | Collision avoidance | Examples |
|---|---|---|---|
| **user-anchor** | Explicit user action | None — exact placement | Right-click create, flatten folder, drag-drop |
| **system-anchor** | System-inferred | Aggressive spiral search | Modal create, paste, fallback |

Collision avoidance is reserved for system-anchor placement because the system
chose the spot — the user has no mental model of where the item "should" go.
Moving it a bit is invisible.

User-anchor placement must be predictable. The user placed something there on
purpose; moving it erodes trust in the interaction even if overlap occurs.
Overlaps are rare in practice because neighboring items were themselves placed
with collision avoidance when created.

## Single items vs groups

| | Single item | Multiple items |
|---|---|---|
| **user-anchor** | `reserveNodePositions` as-is (skips collision) | Compact layout at anchor, no adjustment |
| **system-anchor** | `reserveNodePositions` as-is (spiral search) | Compact layout + spiral search each item |

Single items always go through the existing `reserveNodePositions` path — no
group layout needed.

Multiple items under a user anchor get a **compact (masonry) layout** computed
relative to the anchor point and placed exactly there. No group-level collision
shift, no per-item spiral.

Multiple items under a system anchor get a compact layout followed by the
existing per-item spiral search (they don't need to stay as a coherent group —
the system chose the area, not a specific spot).

## Flatten action

Right-click a folder → Flatten:

1. Fetch folder's children from server
2. Compute compact/masonry layout anchored at the folder's position
3. Move children to parent folder with computed positions
4. Delete the (now empty) folder

No collision avoidance. The folder already occupied that space — its children
inherit it naturally.

## Server-side placement

The placement math is pure (no DOM, no React). A copy lives on the server at
`server/src/lib/canvas-layout.ts` to authoritatively compute and persist
positions on flatten requests. Client and server implementations are verified
to produce identical output via a shared test fixture.
