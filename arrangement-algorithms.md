# Multi-Select Arrangement on an Infinite Canvas

## Problem

Arrange selected cards into a compact grid without losing the spatial intent the user established on the canvas. The interaction must be predictable, fast, reversible, and remain near the original selection.

## Eventual approach: In-place reading-order table grid

This is the approach we ship now. It deliberately does **not** avoid or resolve collisions with unselected nodes: arranging a selection must not silently move content the user did not select.

### 1. Anchor at the selection bounds

Compute the selected cards' bounding rectangle and use its top-left corner (`min x`, `min y`) as the grid origin. The grid grows right and down from there. It is independent of the viewport and does not privilege an arbitrary single card.

This keeps the operation attached to the user's existing spatial narrative: a wide collection stays wide-ish in the same region of the board, rather than teleporting to a viewport or centroid-derived location.

### 2. Preserve human reading order

Cards are ordered before cells are assigned:

1. Sort by `y`.
2. Build row bands: cards belong to the current band when their `y` is within half the average selected-card height of that band's first card.
3. Sort every band left-to-right by `x`.
4. Concatenate the bands.

The result is the top-to-bottom, left-to-right order a person sees in a loosely arranged moodboard, rather than an arbitrary ID or distance ordering.

### 3. Choose a shape that resembles the selection

Use the selection bounding box, including card dimensions, to choose columns:

```
columns = clamp(round(sqrt(count * boundingWidth / boundingHeight)), 1, count)
rows = ceil(count / columns)
```

This makes a wide selection produce a wider grid and a tall selection produce a taller one. A future menu control can override the column count; a future viewport cap can limit exceptionally wide selections.

### 4. Use table-style tracks

For each row, its height is the largest **measured rendered** card height in that row. For each column, its width is the largest measured card width in that column. Cells are positioned from the accumulated track sizes plus the fixed canvas-unit gutter (`BOARD_ITEM_GAP`), and cards are top-left aligned. This makes the minimum vertical separation between rows exactly match the horizontal gutter, instead of reserving space from a generic card-height estimate.

Cards retain their own dimensions and image aspect ratios. Although current cards share a width, computing both tracks keeps the layout correct when card widths become variable.

### 5. Accept overlap with unselected cards

The arranged cards are brought to the front and may overlap unselected cards. This is intentional and reversible: selection is explicit, so the app should not move any unselected card or displace the grid to a surprising distant location.

An optional future “smart placement” mode can search for a nearby clear placement for the complete grid as one rigid block. It must remain opt-in.

### 6. Motion and undo

The client animates positions with a short ease-out transition (150 ms), persists all positions in one batch mutation, and therefore keeps Arrange as one undoable logical action once history is wired in. It does not pan or zoom the viewport.

## Compact layout

**Compact** is a second, shipped action that uses the same top-left anchor, reading order, column count, gutter, animation, and persistence as Arrange. It places each card in the currently shortest column, producing a masonry-style result for mixed-height cards. This deliberately trades aligned rows for denser vertical packing.

## Align columns

**Align columns** is a layout-preserving alternative to Compact. It infers columns from the selected cards' current horizontal positions, snaps each card to its nearest inferred column, and leaves every `y` position unchanged. It is useful when the user likes the existing composition but wants its columns to look deliberate.

## Algorithm

```
function arrangeInGrid(selected):
    if selected.length < 2: return current positions

    bounds = boundsOf(selected)
    ordered = rowBandSort(selected)
    columns = aspectRatioColumns(selected.length, bounds.width / bounds.height)
    rowHeights, columnWidths = tableTracks(ordered, columns)

    for each ordered card at row, column:
        place card at (
            bounds.left + columnOffset(columnWidths, column),
            bounds.top + rowOffset(rowHeights, row)
        )

    bring selected cards to front
    return positions in the caller's original node order
```

**Cost:** `O(n log n)` for the reading-order sort and `O(n)` for track measurement and placement. There is no obstacle search.

## Alternatives deferred

- **Rigid-block free-space search:** useful as an opt-in smart-placement setting when users want fewer overlaps.
- **Hungarian assignment:** globally minimizes a cost function but costs `O(n³)` and does not improve the in-place interaction by itself.
- **Force-directed layout:** suited to graph visualization, but non-deterministic and unnecessarily slow for a deliberate card grid.
