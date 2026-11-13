# Web lint warnings left to fix

`apps/web` lints with `oxlint . --max-warnings 151`. That number is a ceiling, not a target: CI fails if the count goes *above* it, so new code cannot add warnings. When you fix some, lower the number in `apps/web/package.json` to match, so the gain is locked in.

This document lists the 151 warnings that were left on purpose. Everything cheap and safe has been cleared or documented; what remains needs real refactoring and is best done one file at a time with the app open in a browser.

Line numbers were generated from the lint output at the time of writing and drift as files change. To refresh them:

```bash
cd apps/web && bunx oxlint . 2>&1 | grep ": warning "
```

## Summary

| Rule | Count | Risk to fix |
|---|---:|---|
| `react(refs)` | 85 | High |
| `react(set-state-in-effect)` | 44 | Medium-high |
| `react(preserve-manual-memoization)` | 6 | Medium |
| `react(immutability)` | 5 | Medium |
| `react(exhaustive-effect-dependencies)` | 4 | Medium |
| `react(memo-dependencies)` | 3 | Low-medium |
| `jsx-a11y(no-autofocus)` | 2 | Low |
| `react(use-memo)` | 1 | Low |
| `react(incompatible-library)` | 1 | Low |
| **Total** | **151** | |

## Where they are

| File | Warnings |
|---|---:|
| `components/board/image-asset-viewer/index.tsx` | 41 |
| `components/canvas/canvas.tsx` | 20 |
| `components/board/note-rich-text.tsx` | 15 |
| `components/board/note-detail-drawer.tsx` | 15 |
| `components/app-shell/workspace-peek.tsx` | 8 |
| `components/board/video-asset-viewer/youtube-video-viewer.tsx` | 6 |
| `components/board/image-asset-viewer/use-image-note-editor.ts` | 5 |
| `components/app-shell/upload-media-dialog.tsx` | 5 |
| `components/app-shell/workspace-asset-view.tsx` | 3 |
| `components/board/color-detail-drawer.tsx` | 3 |
| `components/board/note-preview-rail.tsx` | 2 |
| `components/board/video-asset-viewer/index.tsx` | 2 |
| `components/canvas/canvas-card.tsx` | 2 |
| `components/board/pexels-browser-panel.tsx` | 2 |
| `components/board/asset-board.tsx` | 2 |
| `components/board/note-editor/mermaid/note-mermaid-preview.tsx` | 1 |
| `components/board/note-editor/save/note-save-status.tsx` | 1 |
| `components/board/note-editor/slash-commands/note-slash-commands.tsx` | 1 |
| `components/board/note-editor/mermaid/note-mermaid-block.tsx` | 1 |
| `hooks/use-mobile.ts` | 1 |
| `components/board/use-asset-fullscreen-shortcut.ts` | 1 |
| `hooks/use-modal-escape-layer.ts` | 1 |
| `components/board/note-editor/mentions/note-mentions.tsx` | 1 |
| `components/collections/rename-collection-dialog.tsx` | 1 |
| `components/canvas/canvas-color-swatches.tsx` | 1 |
| `components/ui/color-picker.tsx` | 1 |
| `components/ui/tabs.tsx` | 1 |
| `components/board/note-backlinks.tsx` | 1 |
| `components/asset-grid/virtual-masonry.tsx` | 1 |
| `components/board/cards/video-asset-card.tsx` | 1 |
| `components/board/asset-context-menu.tsx` | 1 |
| `components/collections/collection-grid-view.tsx` | 1 |
| `components/canvas/canvas-arrow-layer.tsx` | 1 |
| `routes/$workspaceSlug/collections/$.tsx` | 1 |
| `routes/$workspaceSlug/inbox.tsx` | 1 |

`note-detail-drawer.tsx` was being edited when this was written, so its warnings were left alone.

## By rule

### Refs read or written during render (85)

`react(refs)`

**What it means.** A `ref.current` is read (or assigned) while the component renders. React may render more than once or out of order, so the value can be stale or inconsistent.

**How to fix.** Move the read into an effect or event handler. For "latest value" refs, assign in an effect (`useEffect(() => { ref.current = value })`) or use `useEffectEvent`. For values that should drive rendering, use state instead.

**Risk.** High. Most sit in the image viewer, canvas and note editor, where refs carry gesture and drag state; a wrong change shows up as flicker, lost drags or stale zoom.

- `components/board/image-asset-viewer/index.tsx`: 603, 1272, 2178, 2179, 2215, 2238, 2255, 2256, 2258, 2259, 2289
- `components/board/note-rich-text.tsx`: 281, 296, 311, 313, 314, 315, 316, 317, 318, 319, 549, 574
- `components/canvas/canvas.tsx`: 345, 366, 423, 495, 1585, 1600, 1636, 1637, 1784, 2903, 2910
- `components/app-shell/workspace-peek.tsx`: 384, 385, 1707, 1842, 2142
- `components/board/note-detail-drawer.tsx`: 397, 462, 463
- `components/board/image-asset-viewer/use-image-note-editor.ts`: 83, 84
- `components/board/note-preview-rail.tsx`: 112, 113
- `components/board/video-asset-viewer/youtube-video-viewer.tsx`: 801, 1202
- `components/app-shell/workspace-asset-view.tsx`: 164, 166
- `components/app-shell/upload-media-dialog.tsx`: 148, 149
- `components/board/asset-board.tsx`: 111, 306
- `components/board/use-asset-fullscreen-shortcut.ts`: 13
- `components/ui/tabs.tsx`: 358
- `components/board/video-asset-viewer/index.tsx`: 647
- `components/board/color-detail-drawer.tsx`: 963
- `components/board/asset-context-menu.tsx`: 599
- `components/collections/collection-grid-view.tsx`: 204
- `components/board/pexels-browser-panel.tsx`: 480

### setState called synchronously inside an effect (44)

`react(set-state-in-effect)`

**What it means.** An effect calls `setState` immediately, which renders once with the old value and again with the new one.

**How to fix.** Derive the value during render, compute it in the event that caused the change, or give the component a `key` so it resets. Effects that sync from an external system are fine and can stay with a comment.

**Risk.** Medium to high. Resetting state "when X changes" is the common case; replacing it with a `key` or a derived value changes when the reset happens.

- `components/board/image-asset-viewer/index.tsx`: 683, 1257, 1373, 1398, 1611, 1642
- `components/board/note-detail-drawer.tsx`: 324, 476, 540, 570, 1277
- `components/app-shell/upload-media-dialog.tsx`: 156, 211, 273
- `components/canvas/canvas.tsx`: 1331, 1888, 1909
- `components/app-shell/workspace-peek.tsx`: 453, 464
- `components/board/color-detail-drawer.tsx`: 132, 186
- `components/canvas/canvas-card.tsx`: 229, 235
- `components/board/note-editor/mermaid/note-mermaid-preview.tsx`: 15
- `components/board/image-asset-viewer/use-image-note-editor.ts`: 193
- `components/board/note-editor/save/note-save-status.tsx`: 27
- `components/board/note-editor/slash-commands/note-slash-commands.tsx`: 394
- `components/board/note-editor/mermaid/note-mermaid-block.tsx`: 137
- `hooks/use-mobile.ts`: 16
- `hooks/use-modal-escape-layer.ts`: 41
- `components/board/note-editor/mentions/note-mentions.tsx`: 693
- `components/collections/rename-collection-dialog.tsx`: 36
- `components/board/video-asset-viewer/youtube-video-viewer.tsx`: 230
- `components/board/note-rich-text.tsx`: 768
- `components/canvas/canvas-color-swatches.tsx`: 38
- `components/ui/color-picker.tsx`: 161
- `components/board/note-backlinks.tsx`: 29
- `components/board/video-asset-viewer/index.tsx`: 112
- `components/app-shell/workspace-asset-view.tsx`: 600
- `components/board/cards/video-asset-card.tsx`: 62
- `components/board/pexels-browser-panel.tsx`: 502
- `components/canvas/canvas-arrow-layer.tsx`: 589
- `routes/$workspaceSlug/collections/$.tsx`: 296
- `routes/$workspaceSlug/inbox.tsx`: 138

### Memoization the React Compiler cannot preserve (6)

`react(preserve-manual-memoization)`

**What it means.** A `useMemo` or `useCallback` has dependencies the compiler cannot prove match what it uses, so it would not keep the manual memoization.

**How to fix.** Make the dependency list match what the callback reads, or remove the manual memoization if the compiler handles it. This usually follows from fixing the refs warnings in the same file.

**Risk.** Medium. Changing dependencies changes when a callback or value is recreated, which matters for effects that depend on it.

- `components/canvas/canvas.tsx`: 2047, 2149, 2268, 2283, 2343
- `components/board/note-detail-drawer.tsx`: 830

### Mutation or use before initialisation (5)

`react(immutability)`

**What it means.** A value is modified after it was passed to React, or a variable is used before its declaration finishes.

**How to fix.** Replace the mutation with a copy or a ref write in an effect, and reorder the declarations.

**Risk.** Medium.

- `components/board/video-asset-viewer/youtube-video-viewer.tsx`: 1032, 1253
- `components/board/image-asset-viewer/use-image-note-editor.ts`: 148
- `components/board/note-rich-text.tsx`: 694
- `components/canvas/canvas.tsx`: 716

### Effect dependency lists (4)

`react(exhaustive-effect-dependencies)`

**What it means.** Only `note-detail-drawer.tsx` remains. Everywhere else the flagged dependencies were reviewed and documented in place with a disable comment saying why (they are re-run triggers the effect does not read).

**How to fix.** Review these together with the drawer refactor.

**Risk.** Medium. Removing a trigger dependency stops an effect from re-running.

- `components/board/note-detail-drawer.tsx`: 327, 688, 699, 1333

### useMemo / useCallback dependency lists (3)

`react(memo-dependencies)`

**What it means.** Missing or extra dependencies on a memoized value.

**How to fix.** Align the list with what the function reads.

**Risk.** Low to medium.

- `components/board/image-asset-viewer/use-image-note-editor.ts`: 162
- `components/board/video-asset-viewer/youtube-video-viewer.tsx`: 1267
- `components/app-shell/workspace-peek.tsx`: 1230

### autoFocus in the note drawer (2)

`jsx-a11y(no-autofocus)`

**What it means.** Two inputs use `autoFocus`.

**How to fix.** Keep them (focus on open is intended) with a disable comment and reason, as done elsewhere, or move focus in an effect.

**Risk.** Low.

- `components/board/note-detail-drawer.tsx`: 1896, 1920

### `useMemo` shape (1)

`react(use-memo)`

**What it means.** The first argument is not an inline function expression.

**How to fix.** Inline the function.

**Risk.** Low.

- `components/board/note-rich-text.tsx`: 322

### Library the React Compiler cannot analyse (1)

`react(incompatible-library)`

**What it means.** A library returns functions or values the compiler cannot reason about (a form or table library, for example).

**How to fix.** Usually nothing to change; add a `"use no memo"` directive if the compiler is enabled, or keep the warning.

**Risk.** Low.

- `components/asset-grid/virtual-masonry.tsx`: 61

## Suggested order

1. **Small files first** (one or two warnings each). They prove the pattern with little risk.
2. **Mid-size files** such as `asset-board.tsx`, `collection-grid-view.tsx` and `color-detail-drawer.tsx`: moderate, mostly refs.
3. **The image viewer, canvas and note editor**: the bulk of the count and the highest risk. Do one file per change, run the app, and exercise drag, zoom, pan, marquee select and note editing before committing.
4. **`note-detail-drawer.tsx`** last, once its in-progress refactor lands.

After each file, run `bun run lint`, `bun run typecheck` and `bun run test` in `apps/web`, then lower `--max-warnings` to the new count.

## Already handled (for context)

- **Tests:** `asset-modal-morph.test.ts` now asserts through per-case functions instead of branches.
- **Accessibility:** two real fixes (the settings tablist and the scratchpad backdrop). The rest are specific disable comments for false positives (a role or label set conditionally or through a `render` prop) and deliberate `autoFocus`.
- **Effect dependencies:** 37 effects carry a disable comment naming the dependency they re-run on without reading it.
