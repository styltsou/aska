# Ambient interface spec

## Purpose

Give the product's quiet moments the same considered spatial language as the
canvas. These treatments should make an empty board, a loading view, or a
sign-in screen feel deliberately composed without adding a competing product
identity.

The system is intentionally CSS-first. It does not require a shader, canvas,
WebGL, image asset, or per-frame JavaScript.

## Design thesis

Aska is a visual workspace: things are gathered, placed, and arranged. Its
ambient visual language should therefore resemble a **quiet canvas**—a thin
construction grid with a small number of oversized, translucent material
blocks. It is architectural, not atmospheric: no aurora, liquid blob, neon
glow, or busy tessellation.

The signature is the **block matrix**: sparse rounded rectangles placed on an
off-axis grid. Most are barely visible; two or three establish depth through
overlap, soft edge diffusion, and subtle tonal contrast. Content always sits
above the matrix, sharp and unblurred.

## Guardrails

- Use three material layers at most: hairline grid, block matrix, content.
- Keep decorative layers non-interactive and hidden from assistive technology.
- Derive the base from existing theme variables; chromatic accents are muted
  blue/lilac in light mode and low-saturation violet/blue in dark mode.
- Do not animate individual cells. If motion is used, move one group over
  90–120 seconds with `transform` only.
- Under `prefers-reduced-motion`, remove all ambient motion.
- Preserve a high-contrast, opaque-enough reading surface for form fields and
  errors. Decoration must never reduce form legibility.
- Keep mobile quieter: a reduced grid and one or two large blocks, no cropped
  visual clutter around the form.

## Auth surfaces

### Selected direction: split canvas preview

Use a two-part desktop composition. The left side is an uncontained sign-in
column on the normal application background. The right side is a cropped,
rounded window into a static Aska canvas: the real 24px dot-grid language with
a denser set of recognizable image, note, and folder cards placed on an even
four-column masonry rhythm across a single perspective-skewed plane. The
entire board carries the rotation; individual cards are not independently
tilted or floated. Each column retains the cards' natural height and begins at
a deliberately offset vertical position, avoiding collisions while keeping the
plane legible as a board. Show enough material above and below the viewport to
clip naturally, with the additional material introduced above the composition
rather than extending its lower edge. Shift the plane right until the right edge is also intentionally
clipped. Angle the board so the right-side items sit nearer to the viewer.

The preview should read as product context rather than illustration or generic
dashboard decoration. Render the production `ImageAssetCard`, `NoteAssetCard`,
and `FolderAssetCard` components with static art-directed data so the preview
cannot drift away from the real board styling. Use a small, cohesive set of
real Unsplash/Pexels imagery with lightweight parameters and local SVG
fallbacks. Favor minimal, real-world objects and architecture with distinct
red, blue, orange, and green anchors; avoid purely abstract imagery.
Auth-specific CSS controls only placement and perspective. There is no data
fetching, carousel, WebGL, or per-card ambient movement. On narrow screens the
preview disappears and the sign-in column takes the full viewport.
Any card shadow is a tight, low-opacity separation from the canvas only; the
shared-plane perspective supplies the depth.
The dot grid belongs to the transformed preview plane—not the outer showcase
window—so its perspective and spacing always agree with the cards resting on
it.

Suggested structure:

```text
┌──────────────────────────────────────────────────────────┐
│ Aska       · · · construction grid · · ·                  │
│   ┌──────────── block ───────────┐                        │
│   │                               │        ┌───────────┐  │
│   │                     ┌───────┐ │        │ tile mark │  │
│   └─────────────────────│ block │─┘        │ Welcome   │  │
│                         └───────┘          │ [email]   │  │
│       ┌───────── block ─────────┐           │ [password]│ │
│       └─────────────────────────┘           │ [Sign in] │ │
│                                              └───────────┘ │
└──────────────────────────────────────────────────────────┘
```

The current implementation applies this treatment to `/login` and `/signup`.
Onboarding remains a separate surface and should adopt the layout only after
the auth treatment is reviewed and refined.

### Considered but not selected: aurora backdrop

A full-page, desaturated mesh of blurred radial/linear gradients is a viable
fallback for a softer brand. It should use 2–3 tones and drift slowly. Do not
combine it with the block matrix; the two signatures compete. The current
direction favors geometry because it connects directly to the product canvas.

### Supporting details

- **Signature mark:** three lightly offset rounded tiles. It may make a
  2–4px settling motion when the form is focused, but only if that motion is
  nearly imperceptible and disabled for reduced motion.
- **Panel / grain subtraction:** an optional faint grain layer may cover the
  page, then fade when a form control gains focus while the panel sharpens.
  This is deliberately deferred: test it only if the geometric field feels
  too sterile, and remove it if it compromises crispness.

## Empty states

### Primary candidate: living gradient tile

Replace a lone empty-state icon with a compact, rounded square formed from
two or three blurred radial-gradient layers. It should feel like a material
sample on the board, not a colorful illustration. A single 30–60 second
`transform` drift can give it breath. The message and primary action remain
the focus.

### Complementary candidate: whisper grid

Place a faint dot or hairline grid behind the empty-state copy, with one soft
radial highlight. It may be used alone for dense layouts, or behind the
living-gradient tile when the surrounding canvas is otherwise empty. Avoid
hover-reactive highlights unless the parent canvas already has meaningful
light interaction.

### Reserve candidate: typographic macro-state

For the most editorial empty views, use one oversized tabular letter or
numeral paired with a thin ring divider. It is a static, deliberately spare
alternative—not a default replacement for every empty state.

### Board-specific candidate: layered tile mark

Where the action is to create or place a board item, use a miniature version
of the auth signature: three or four offset rounded rectangles. This ties
empty states to the block-matrix language more semantically than a generic
image icon.

## Loading states

Masonry loading should use one shared shimmer sweep across the grid, rather
than independently animated cards. The cards retain their normal neutral base
color; a single wide, low-contrast gradient moves through the masonry wrapper.
This provides a coherent loading cue without per-card timing noise or layout
work. It must stop under reduced motion.

## Implementation sequence

1. Build and refine the sign-in block-matrix backdrop and panel. Completed for
   sign-in and sign-up.
2. Extract only the proven decorative primitives, if reuse remains useful.
3. Apply the approved auth treatment to onboarding.
4. Add the selected empty-state treatments one surface at a time.
5. Replace the masonry skeleton animation with the shared sweep.
