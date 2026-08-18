# Canvas Placement Policy (Revised Draft)

This is a proposed revision of the current placement policy. It keeps
everything that works, fixes two real inconsistencies in the current
behavior, and closes the viewport-anchor bug caused by resolving
unanchored placements server-side.

Every creation or move resolves one placement context (PC), then uses the
same card-footprint and 32-pixel-gutter collision rules. Positions are
persisted on collection nodes; viewports remain local browser state and are
never a shared source of truth — the fix below is about respecting that
constraint properly, not changing it.

## Core principle

**The server resolves collisions against an anchor it is given. It never
infers an anchor on its own.** Any context that has spatial intent (a click,
a drop, a pointer position) already produces a client-observed coordinate.
Any context that lacks spatial intent must have its anchor computed
client-side (viewport centre, composition centre) and passed into the
placement request as data, exactly the way canvas paste already passes the
last pointer position. This single rule is what fixes the "cards land at
canvas origin instead of viewport centre" bug: that bug exists because
header/palette/note-extraction currently ask the server to _decide_ an
anchor it has no authority to compute, instead of _receiving_ one.

## Placement contexts

| Context                                  | Anchor                                                   | Anchor resolved by                | Search area                    | Collision behavior                             |
| ---------------------------------------- | -------------------------------------------------------- | --------------------------------- | ------------------------------ | ---------------------------------------------- |
| Canvas context menu                      | Captured flow-space click                                | Client (has spatial intent)       | None                           | Bounded local nudge only                       |
| Direct file drop                         | Actual flow-space drop event                             | Client (has spatial intent)       | None                           | Bounded local nudge only                       |
| Canvas paste                             | Last pointer position on that canvas                     | Client (has spatial intent)       | None                           | Bounded local nudge only                       |
| Header, command palette, note extraction | Current viewport centre, computed and sent by the client | **Client** (changed — see below)  | None                           | Bounded local nudge only                       |
| Move into a folder                       | Destination composition centre                           | Server (no spatial intent exists) | Destination composition bounds | Bounded local nudge only (changed — see below) |

Two things changed from the current policy, both discussed below:
overlap is no longer allowed to pass silently, and folder moves no longer
run a full centre-outward search.

### Why "bounded local nudge" everywhere, not full avoidance

An anchored action (right-click, drop, paste) carries explicit spatial
intent from the user. If the resolver moves the card somewhere else to
dodge a collision, it has overridden that intent, which reads as
unpredictable rather than helpful. Conversely, doing _nothing_ about
collision (today's behavior for header/palette/note-extraction, which
places at centre "even if it overlaps") makes an action look like it
silently failed, because the new card visually disappears under an
existing one.

The fix is the same in both directions: a small, deterministic offset —
e.g. one gutter-width in a fixed direction, repeated if still occupied,
capped after a few steps — applied only when the target point is actually
occupied. The card always appears where the user pointed (or where the
viewport/composition centre was), just visibly nudged clear. No searching,
no relocating to open space elsewhere on the canvas.

### Why folder moves no longer get a full composition search

Folder moves currently run a centre-outward search across the whole
destination composition. That's a different, more thorough algorithm than
every other "no PC" context gets, even though a folder move has exactly as
little spatial intent as opening the command palette — there is no
directional signal to honor either way. Two different behaviors for the
same underlying situation (no intent) is the inconsistency worth removing.

Bringing folder moves in line with the rest of the "no PC" row means:
composition centre, bounded local nudge, same as everywhere else. If in
practice folders get dense enough that nudge-only produces visibly stacked
clutter more often than the open canvas does, that's worth measuring
before deciding whether folders deserve an exception — but the default
should be the same rule as everywhere else, not a bespoke search.

If no nudge position is available at all, a card is persisted at the
anchor point rather than an unrelated, distant coordinate — this part of
the current policy is unchanged and still correct.

## Batches

Multi-image insertions start from their resolved anchor (client-computed,
per the table above) and use a fresh four-column grid. The horizontal and
vertical gutter is the canvas-wide 32 pixels. A row advances by the
tallest card in its row plus that gutter, so portrait images never overlap
the next row. Batch state is not remembered between actions.

When an import creates batch items sequentially, its placement context
still carries the dimensions of the complete batch. Every item resolves
against the same grid and the same tallest-card row heights as a direct
multi-file drop.

This grid approach is deliberately different from folder-move batch
placement (which packs into existing composition space — see below). They
solve different problems: creation batches are about laying out new
content coherently; folder-move batches are about fitting into a
destination that may already be dense. Keeping two mechanisms is
intentional, not an inconsistency to unify.

### Folder-move batches

Each moved node searches for a nudge position centre-outward from the
composition centre, wholly inside the composition bounds; earlier
positions in the same batch are included when placing later nodes, so
batch items don't overlap each other either. Tie-breaking during the
search should scan in a fixed order (left-to-right, top-to-bottom) so
repeated moves of the same batch produce the same layout rather than
depending on incidental ordering.

## Fit-to-view after placement

Currently, an anchor only guarantees _itself_ is visible — "the rest of a
large batch may extend beyond it." For a 15-image drop, that can leave a
user seeing 4 cards with no indication the rest exist until they go
looking.

Proposed addition: after a batch creation whose resulting bounding box
exceeds the current viewport, smoothly animate the camera to fit that
bounding box.

- **Prefer pan over zoom.** Only zoom out when the batch genuinely doesn't
  fit at the current zoom level — rescaling changes the reading context for
  everything already on the canvas, which is a bigger perceptual jump than
  panning.
- **Coalesce rapid actions.** If several batches are inserted in quick
  succession, debounce so camera moves don't fight each other.
- **Respect `prefers-reduced-motion`.**
- **Scope: open-canvas batch creation only.** Folder-move batches are
  already constrained to the destination composition's existing bounds,
  so the "extends past viewport" problem doesn't apply there by default.

Single-item and small-nudge placements (everything in the contexts table
above, once anchors are properly client-resolved and nudges are bounded)
should **not** trigger auto-pan. If nudges stay small and deterministic,
the result should already land within or very near the current view —
there's nothing to pan to, and panning the camera immediately after a
click/drop/paste the user just made would undercut the same predictability
the bounded-nudge rule is protecting.

## Legacy and unavailable context

Legacy rows that do not yet have persisted coordinates still render
through a deterministic fallback grid. This remains a compatibility path,
not a placement policy for normal creation or moves — unchanged from the
current policy.

## Open items to confirm before implementation

1. **Nudge step size and cap.** Proposed: one gutter-width per step,
   capped at N steps before falling back to "place at anchor anyway."
   Needs a concrete N.
2. **Stale/missing client viewport signal.** If the client fails to send a
   viewport anchor (race condition, non-canvas entry point), define an
   explicit degraded server-side fallback rather than letting it silently
   default to canvas origin as it effectively does today.
3. **Folder density exception.** Decide whether to measure whether
   nudge-only placement in folders produces enough visible clutter to
   justify a bespoke search after all, or whether the consistent rule is
   sufficient in practice.
