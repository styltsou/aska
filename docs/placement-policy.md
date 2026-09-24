# Canvas Placement Policy

Canvas positions are signed integer flow-space coordinates. Explicit pointer
placement (context-menu insertion, direct drop, and paste) keeps the requested
anchor. Header and command-palette insertion finds a nearby free position in
the current visible canvas. Legacy items without coordinates use a stable
fallback grid until they receive an authored position.

## Moving an authored composition

Every move from a canvas to another folder or collection uses one placement
rule, regardless of whether the selection contains cards, text, arrows, or a
mix. The moved items retain their relative coordinates. The server computes
the source composition bounds, chooses a destination anchor, and translates
every moved position, free arrow endpoint, and bend by the same offset.

An empty destination uses `(48, 48)`. Otherwise, the group starts at the
destination composition's centre. A bounded, deterministic search looks for
a position where the group does not overlap existing card and text footprints;
if none fits, the intact group remains at that centre. Arrow paths contribute
to the moved bounds but do not reserve destination collision space.

An unselected arrow joins a move when both of its bound targets move. An arrow
crossing the source/destination boundary remains on its side and detaches the
crossing endpoint at its last visible coordinate. Folder moves preserve the
positions of descendants inside the folder. Flattening a folder translates
its direct children together into the parent composition.

Inbox items have no authored canvas positions. Moving an Inbox batch into a
collection gives those items new destination positions through the existing
Inbox placement path.
