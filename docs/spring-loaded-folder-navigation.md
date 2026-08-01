# Spring-Loaded Folder Navigation (Planned)

## Status

This is a product and technical design for a future interaction. It is not
implemented. The existing canvas-to-canvas folder drop remains the source of
truth for current behavior; see [Collection Canvas Architecture](./collection-canvas.md).

## Intent

While dragging one or more canvas items, people should be able to move through
the folder hierarchy without releasing the drag. A brief, deliberate hover over
a navigation target opens it and retains the drag, so the items can be dropped
in a deeper destination. This interaction is conventionally called
*spring-loading*.

The feature is for organization, not a new way to browse folders. It must make
direct drops faster without making ordinary canvas placement or navigation
surprising.

## Scope and interaction boundaries

| Surface | On hover during drag | On release |
| --- | --- | --- |
| Canvas folder card | Highlight as a direct folder-drop target. Never auto-open. | Move into that folder. |
| Sidebar folder in the current board | Highlight and prefetch. Sustained hover may spring-load into it. | Move into that folder. |
| Ancestor breadcrumb | Highlight and prefetch. Sustained hover may spring-load back to it. | Move into that folder. |
| Current-folder breadcrumb | Not a target. | No move. |
| Collection/root breadcrumb | Deferred until the move API supports moving items to the collection root. | No move. |

Canvas cards deliberately do not spring-load. A card is both a spatial object
and a direct-drop target, so auto-opening it on an ordinary positioning hover
would make a reliable drop feel unsafe. The sidebar and breadcrumbs are
explicit navigation chrome, where a sustained hover unambiguously expresses
navigation intent.

The initial release supports only same-collection moves and the persisted
nodes that the current move operation supports. A client may show a target as
invalid, but the server remains authoritative for all eligibility checks:

- A node cannot be moved into itself.
- A dragged folder cannot be moved into one of its descendants.
- Every selected node and the target must still belong to the same collection.
- A source parent changed by another mutation invalidates the pending move.

## Delivery sequence

### Phase 1: external direct-drop targets

Make sidebar child folders and ancestor breadcrumb folders drop targets using
the existing batch move mutation. This is useful on its own and establishes the
shared target-registration and eligibility model needed later.

The canvas drag controller, rather than DOM `dragenter` handlers on the chrome,
must determine hover from the pointer position and registered target bounds.
XYFlow owns pointer capture during its node drag, so relying on regular hover
events from sidebar or header elements is not reliable.

Show a target outline/fill and a concise accessible description such as
"Move 3 items to Typography." Do not introduce hover navigation in this phase.

### Phase 2: prefetch

On entering a valid navigation target, immediately prefetch its unfiltered
collection-contents query. Prefetch only the current candidate; canceling or
leaving a target cancels its spring timer, not the cache entry. A short cache
window makes subsequent navigation feel immediate without preloading the whole
folder tree.

### Phase 3: spring-loaded navigation

After the pointer remains within a valid sidebar-folder or ancestor-breadcrumb
target for **700 ms**, navigate to that target if its destination query has
resolved successfully. Show a visible radial/progress affordance while the
timer runs. Leaving the target, changing targets, ending the drag, or losing
eligibility cancels both the timer and progress affordance.

The 700 ms value is a starting point for usability testing, not a permanent
constant. It should be centralized as a named interaction setting.

Navigation must not occur into an unloaded board. If the prefetch is still in
flight when the timer completes, keep the target in its ready state and navigate
as soon as that query succeeds *while the pointer remains over the target*.
If it fails, keep the user in the current board, remove the progress state, and
allow a normal drop onto the target. Do not strand a drag behind an error view.

## Drag session architecture

Phase 1 can extend the current canvas-owned drag handling. Phase 3 cannot
safely do so: navigating changes the route and unmounts the XYFlow board that
owns the active pointer interaction.

Before Phase 3, introduce an app-shell-level drag coordinator with a durable
session containing:

- stable IDs of dragged nodes, source collection and source parent;
- a snapshot used for the preview (primary card, group count, dimensions, and
  pointer offset), with no server data copied into the drag session;
- pointer position, active target, target validity, and spring timer state;
- the destination route/query readiness and the latest move eligibility input.

Render the drag preview in an app-shell portal above routed content, with
`pointer-events: none`. It must survive a route transition and follow the
pointer without flicker. The preview is visual only; dropping still calls the
existing server move operation and the React Query cache transition remains
responsible for optimistic data changes.

The coordinator needs explicit pointer capture and cancellation handling. A
lost pointer capture, Escape, browser blur/visibility loss, route error, or an
invalidated source must end the session, remove the preview, and leave data
unchanged. Releasing over an empty canvas after spring-loading places nothing;
the user must release over a valid folder target. This preserves the current
meaning of a folder move and avoids inventing a coordinate-placement rule for a
cross-route drag.

## Visual and motion rules

- Entering a navigation target: immediate target highlight and prefetch.
- Waiting: progress ring/underline fills over 700 ms; no layout shift.
- Spring-load: retain the preview continuously while the destination board
  replaces the source board. The destination may fade in briefly only after
  its data is ready.
- Cancel/leave: target and progress reverse promptly; never navigate after the
  pointer has left.
- Reduced motion: use a static readiness indicator instead of an animated
  ring, while retaining the same timing and behavior.
- Multiple items: preview the primary card plus a count; do not render a large
  stack of live canvas nodes.

Use the existing folder-drop visual language where possible. The feature should
feel like one move interaction spanning more than one navigation surface.

## Data, cache, and mutation rules

Destination contents must be present in React Query before navigation so the
routed board has immediate data. The coordinator should use the same canonical
collection-content query key as the board, never create a second cache or
shadow folder model.

Do not mutate on spring-load. Mutation occurs once, only on a valid release.
Use the current move mutation's optimistic transition, rollback, and
invalidation behavior. The server's expected-parent check remains required:
preloading or navigating must not make a stale drag valid.

Moving items to collection root is intentionally excluded until the API and
cache transition explicitly support a `null` target parent. When that is added,
the collection breadcrumb can become a direct-drop and spring-load target.

## Accessibility and input fallback

Drag-only behavior is insufficient. The same destinations must be available
through an accessible Move action for keyboard and touch users: choose one or
more items, invoke Move, then choose a folder from a navigable tree or list.
The action must share the same eligibility rules and server mutation.

For pointer drag, announce target changes through a polite live region, e.g.
"Move 3 items to Typography. Hold to open." Announce when a folder opens and
when a target becomes invalid. Escape cancels without a mutation.

## Acceptance criteria

1. A persisted item or eligible selection can be dropped onto a visible sidebar
   child folder or ancestor breadcrumb and moves atomically.
2. Invalid targets never display a successful-drop state and never trigger a
   move request.
3. Hovering a canvas folder card never navigates; release still moves into it.
4. Hovering a valid navigation target starts prefetch and visible progress;
   leaving before the delay never changes route.
5. A successful spring-load shows the destination without a data-loading flash
   and retains a continuous drag preview.
6. After spring-loading, a parent breadcrumb can spring-load back while the
   same drag session remains active.
7. Escape, pointer cancellation, failed prefetch, and failed move leave no
   ghost, timer, or optimistic hierarchy corruption.
8. Reduced-motion and keyboard/touch move flows remain usable.

## Open questions to validate in prototyping

- Is 700 ms the right default for the product's audience and pointer devices?
- Should a sidebar target spring-load by opening the board, or first expand a
  tree once the sidebar gains nested-tree navigation?
- Does the move picker need to ship with Phase 1, or can it be tracked as the
  accessibility completion requirement for the broader move feature?
- Should spring-loading be enabled by default on touch-capable laptops, where
  accidental long presses may be more common?
