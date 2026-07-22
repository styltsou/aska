# Collection Canvas Architecture

Aska deliberately uses different interaction models for its two visual
surfaces:

- The Inbox is an archive and retrieval surface rendered as a masonry grid.
- A collection or folder is an authored moodboard rendered as an infinite
  spatial canvas.

The product behavior is defined in the
[Board Product Specification](../BOARD_PRODUCT_SPEC.md). This document records
the implementation boundaries that keep the canvas behavior maintainable.

## Ownership Boundaries

Aska owns the collection data model. Node identity, hierarchy, asset metadata,
and positions are persisted through Aska APIs. `@xyflow/react` is the client
renderer and interaction adapter; its graph data model is not persisted as a
second source of truth.

The Inbox continues to render through the existing `AssetBoard` masonry path.
Collections and folder contents render as XYFlow custom nodes through
`client/src/components/canvas`.

Folders are first-class canvas nodes. Opening one navigates to its own canvas;
moving the folder on its parent canvas never changes the positions of its
contents.

## Coordinates and Placement

Every positioned collection node exposes `position: { x, y }`. Coordinates are
signed integer CSS pixels, allowing placement and panning in every direction.
Dragging is freeform: there is no grid snapping, collision resolution after a
drop, or artificial canvas extent. Positions are rounded only to whole pixels
before persistence. When an insertion coordinate is already occupied, Aska
finds a nearby available position using card footprints and spacing; a free
requested coordinate is never adjusted.

Existing rows without coordinates receive deterministic fallback positions
based on the API's stable node order. New notes, folders, and images can reserve
a position captured from the context menu in flow space. Automatic fallback
placement does not constrain later manual placement.

Asset cards have a 280-pixel base width and retain their content-driven height.

## Drag State

React Query remains the shared server-state cache. During a drag and while a
position write is queued, XYFlow owns the immediate node position locally. When
the write begins, the client updates the query cache before sending the mutation
and rolls back both local and cached state if persistence fails. This prevents a
successful drop from briefly rendering stale server coordinates.

Position writes are serialized per node in the browser. If a user completes
another drag while that node's previous write is in flight, the client retains
only the newest pending position and sends it after the active write settles.
This prevents a delayed earlier request from overwriting that user's later drag,
avoids redundant requests during rapid consecutive drags, and still allows
different nodes to save independently.

This is intentionally a client-side improvement for the current non-realtime
canvas. It does not coordinate writes from separate browser tabs, devices, or
users. Cross-client ordering and real-time collaboration require a server-side
revision or concurrency protocol.

The completed drag is persisted with:

```txt
PATCH /api/v1/workspace/:workspaceSlug/collections/:collectionSlug/nodes/:nodeId/position
```

Every position request carries the parent folder expected when dragging began.
If the node was moved into a folder before a delayed position request arrives,
the server returns a conflict instead of writing source-canvas coordinates into
the destination placement.

Dragging a persisted image, note, or folder over a visible folder card is a
separate same-collection move operation:

```txt
PATCH /api/v1/workspace/:workspaceSlug/collections/:collectionSlug/nodes/:nodeId/parent
```

The pointer must be within the folder bounds. The client uses XYFlow's measured
geometry and highlights only the deterministic topmost candidate. A successful
drop removes the source-canvas node, resets its destination position to null,
and skips the position mutation. Moving a folder preserves every descendant
placement and authored descendant position while transactionally rewriting the
subtree's cached folder paths. Optimistic notes, pending uploads, Inbox items,
group drops, moves to the collection root, and cross-collection moves are not
supported.

The client optimistically patches every cached source and destination type
variant. Asset moves update the target's count and direct-child preview. Folder
moves update the target's recursive asset count by the moved folder's count but
do not add a preview, because folder previews represent direct asset children.
All collection-content queries are invalidated after settlement so cached
subtree routes reconcile against the server.

Optimistic notes and image uploads remain draggable before their server node is
ready. Their local position is keyed by a client identity and transferred to
the resolved node before a single position update is sent. Pending cards do
not open or expose asset actions; notes show a subtle saving indicator and
images retain their upload status.

## Viewport and Controls

The canvas fills the rounded AppShell content surface and follows the shell's
outer right and bottom insets; it is not placed inside an additional board
panel. It uses XYFlow's built-in viewport, background, controls, auto-pan,
touch gestures, visible-element rendering, and `Panel` placement. The visible
zoom control uses the existing shadcn button and tooltip primitives and caps
Fit view at overview scale with composition padding. It does not show a
minimap. The same control includes a
session-local canvas lock that disables node dragging while keeping navigation
and creation actions available.

The AppShell owns the canvas surface color, which is the same `bg-card` used by
the collection overview. The XYFlow renderer remains transparent. Route and
query loading states preserve this surface and show spatial card placeholders
rather than the Inbox's masonry skeleton.

Viewport and lock state are stored in local browser storage and scoped to each
collection or folder. They are not part of the persisted collection model.
Filter-bar state follows the same scope, keeping collection focus filters
separate from Inbox retrieval filters.

When a collection filter is active, XYFlow retains every node in local state so
the authored composition and node positions remain intact. Non-matching images
and notes are low-opacity and noninteractive; folder cards stay available for
navigation. Matching nodes remain fully visible. A ranked color-result
navigator can focus a chosen match, but filters never reorder, clone, or move
canvas nodes. See [Color Image Search](./color-image-search.md) for the request
lifecycle and ranking boundaries.

Edges, handles, connection behavior, and delete-key node removal are disabled.
The canvas is a moodboard, not a diagram editor.

## Backend Storage

`collection_nodes.position_x` and `position_y` store authored coordinates as a
nullable pair. The database permits signed values and enforces that either both
coordinates are present or both are null.

`uploads.position_x` and `position_y` carry an optional reserved coordinate
through asynchronous image processing so the finalized image appears at the
intended canvas location.

## Deferred Capabilities

- Multi-select actions and resize handles.
- Deliberate z-ordering and arbitrary canvas objects.
- Relationships and other diagram-style features.
- Durable viewport persistence across sessions.
