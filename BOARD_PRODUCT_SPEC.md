# Board Product Specification

## Purpose

Aska has two distinct surfaces for visual references:

- The **Inbox** is the capture and retrieval surface.
- A **collection** is an authored visual moodboard.

They deliberately use different interaction models. The Inbox optimizes for
finding and triaging an expanding archive. Collections optimize for arranging
references into a meaningful visual composition.

## Inbox

The Inbox remains a masonry grid with incremental loading. It is not a manual
canvas and does not support drag-and-drop ordering.

### Ordering

- The default order is **date added, newest first**.
- The newest item must be the first item in the board's visual scan order.
- Supported sort choices are automatic retrieval views, not saved manual
  orders. Initial choices are date added (newest and oldest); recently edited
  and favourites-first may be added when those states are useful.
- Changing sort is compatible with incremental loading. A sort is a view of the
  archive, not a change to the assets' intrinsic order.

### Product boundary

The Inbox captures, reviews, filters, searches, and moves references into
collections. A user who wants a persistent sequence or composition creates or
uses a collection rather than manually ordering the Inbox.

### Color image retrieval

Color search is a delivered retrieval view for images. A user can select up to
five color swatches, including a custom color, and Aska ranks the images in the
current Inbox by how well their extracted palettes match the complete query.
The swatch selection is converted from display sRGB to OKLab in the client and
debounced briefly before search, so adjusting a palette does not issue a
request for every intermediate selection.

- Color search changes the Inbox view only; it never changes archive order,
  asset metadata, or collection membership.
- While a new palette is being ranked, the last successful retrieval view stays
  visible rather than clearing the board.
- The first release searches the Inbox only, not every image in the workspace.
- Results are ranked and capped by a quality threshold rather than padded to a
  fixed result count.

## Collections

A collection has one spatial model: an effectively infinite canvas. It does not
switch between a sortable browse view and an arrange view.

- The canvas can be panned in every direction and is not anchored to a
  top-left origin or content bounds.
- Users can zoom out for orientation or zoom in for closer composition work.
- The collection canvas is the main content surface. It follows the shell's
  outer insets and rounded content radius without adding a second board-colored
  container inside it.
- At the default scale, asset cards are approximately 280 pixels wide so five
  to six cards fit across a wide desktop viewport.
- Opening an asset remains the detail interaction; zoom is primarily for
  navigation and composition.

### Spatial rules

- Every root item has a persisted, user-defined signed x/y position.
- Placement is freeform. Dragging does not snap to a grid or clamp coordinates
  to a positive quadrant.
- Cards retain a consistent base width and their natural content height.
- Manual placement may overlap. The canvas never reflows or automatically
  moves neighboring items after a drop. New items requested at an occupied
  canvas coordinate are placed at a nearby available position instead.
- New items created from a canvas context use the captured canvas coordinate.
  Batch additions continue horizontally from that point. Items without a
  captured coordinate receive deterministic fallback placement.
- Collections have no automatic sort. An automatic reorder would overwrite the
  spatial meaning a user has created.
- A dropped position remains visually stable while it is saved. Failed saves
  roll the card back and report the error.

### Navigation

- Pointer drag and trackpad scrolling pan the canvas.
- Pinch gestures zoom. Explicit zoom and fit controls remain available.
- The canvas does not show a minimap; fit and zoom controls provide overview
  navigation without persistent secondary chrome.
- Fit view includes composition padding and never zooms beyond the overview
  scale.
- The viewport control can lock a canvas, disabling node dragging while
  preserving pan, zoom, navigation, and creation actions.
- Viewport and lock preferences are persisted locally and scoped to each
  collection or folder board.

### Finding and filtering

Search and filters operate on the collection without changing its layout.
Filtering de-emphasizes non-matching image and note items rather than removing
them from the spatial map; matching items retain their positions and remain
fully visible. Non-matching content is low-opacity and noninteractive while
folder cards remain available for navigation. Search results can focus the
canvas on a chosen item without reordering, cloning, or moving any nodes.
Collection filter state is scoped to the current collection or folder; it does
not inherit Inbox retrieval filters.

Color search is available on the current collection or folder board. The result
navigator moves the viewport between ranked image matches; it does not modify
the canvas. Recursive folder-subtree and whole-workspace color searches remain
deferred because their results need cross-board navigation rather than a local
canvas focus state.

## Folders

Folders are first-class nodes on a collection canvas. This preserves their
current role as visible containers while allowing their placement to contribute
to the composition.

- A folder is freely positioned and moved like other canvas items.
- Its card is visually distinct from image and note cards while following the
  same base-width rhythm.
- Opening the folder enters its own infinite sub-canvas.
- Moving a folder on its parent canvas never changes positions inside the
  sub-canvas.
- Contents of a folder appear only inside that sub-canvas; the parent canvas
  shows the folder card rather than duplicating its children.

Folders may be nested through explicit creation and navigation flows. Persisted
image, note, and folder cards can be dragged from the current canvas onto a
visible child-folder card. The move resets the moved node's destination position
and preserves asset collection membership. Moving a folder preserves the
subtree's hierarchy and every descendant's authored position.

## Design Principles

- Preserve user-authored spatial meaning in collections.
- Keep automatic, archive-oriented behavior in the Inbox.
- Let the canvas remain visually quiet so the references are the dominant
  material.
- Prefer direct manipulation and free placement over hidden layout correction.
- Do not introduce a second grouping system that competes with folders.
- Keep navigation and manipulation predictable on desktop and touch devices.

## Implementation Direction

The collection canvas uses `@xyflow/react` for viewport transforms, gestures,
node dragging, viewport culling, panel placement, and background behavior.

- Aska collection nodes and positions remain the source of truth. XYFlow nodes
  are a client rendering adapter, not the persisted domain model.
- Do not expose edges, connection handles, or diagram-editor affordances.
- Keep `snapToGrid`, `nodeExtent`, and `translateExtent` disabled.
- Keep the dropped node position in local canvas state while the API mutation
  updates the React Query cache and server.
- Use the existing shadcn button and tooltip primitives for the visible zoom
  control; XYFlow's `Panel` owns its viewport-relative placement.
- Use XYFlow's supported components and interaction APIs before introducing
  custom viewport or pointer infrastructure.
- Avoid WebAssembly unless profiling identifies a CPU-bound computation that
  cannot be addressed in JavaScript or by moving work off the main thread.

## Future Expansion

Collections are not diagram editors. Relationship edges, arbitrary canvas
shapes, freehand drawing, deliberate layering controls, remain deferred. Add them only when collection workflows show
a concrete need rather than because the canvas engine supports them.

## Out of Scope

- Manual ordering in the Inbox.
- A collection browse/arrange mode toggle.
- Automatic collision avoidance or layout reflow after a drag.
- Semantic lane or kanban-style grouping.
- Treating folders as navigation-only chrome outside the canvas.
- Edges, graph relationships, and graph-editor connection affordances.
