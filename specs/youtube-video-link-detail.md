# YouTube Video Link Detail — Product & Implementation Spec

## Status

Proposed follow-up to the shipped `youtube-oembed` resolver. This is a
separate feature from reliable URL unfurling and should ship in its own change.

## Purpose

A YouTube link should be usable as a compact board card and enjoyable to view
without leaving Aska. Opening the card presents a focused video detail view:
the embedded video, its title, source, and a direct channel link. The compact
card remains a visual reference, not a miniature player.

## Product decision

Create a **responsive YouTube video viewer** for resolved YouTube video
resources: a centered non-fullscreen modal on desktop/tablet and an edge-to-edge
bottom sheet below 768px.

- Activating a resolved YouTube card opens the dialog instead of immediately
  navigating away from Aska.
- The dialog mounts a paused, privacy-enhanced YouTube embed after that explicit
  user action. It never autoplays.
- The dialog exposes the video and channel-link metadata without extra provider
  controls in the player header.
- Every saved link supports an optional personal plain-text note. The YouTube
  viewer is the first link detail surface that exposes the editor.
- Ordinary links, unresolved links, and all non-YouTube resources retain their
  current external-link-card behavior.
- This release does not add the YouTube Data API. Description is optional: show
  the existing resolved description when present and omit the section when it
  is absent. The generic metadata resolver may provide one from public HTML
  metadata, but YouTube does not reliably expose it there. Do not scrape watch
  pages to fill it.

## Card interaction

For a link whose resolution is ready or partial, `resourceKind` is `video`, and
the API has supplied a supported YouTube payload:

1. Card click, Enter, or Space opens the detail dialog.
2. Existing modifier-click behavior continues to manage board selection. A
   distinct **Open on YouTube** action opens the original link in a new tab.
3. While queued or resolving, the card remains a normal external link so its
   expected behavior does not change before video identity is known.
4. If the video payload is unavailable, use the current external link behavior
   even if `resourceKind` happens to be `video`.

The existing context menu gains **Open video details** and **Open on YouTube**
for eligible cards. Card affordances must make the destination clear: the
primary surface opens details, while the external-link icon/action opens
YouTube.

## Video detail dialog

Use a centered, non-fullscreen modal rather than a persistent side rail on
larger screens. Video needs a large 16:9 stage and should not resize the board
while playing. On phones, use the app's downward-swiping bottom drawer.

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│        ┌──────────────────────────────────────────────┐      │
│        │            16:9 embedded video                │      │
│        └──────────────────────────────────────────────┘      │
│                                                              │
│ Video title                                                  │
│ Channel name ↗                                               │
│ Optional resolved description                                │
└──────────────────────────────────────────────────────────────┘
```

- Desktop: width is constrained by the viewport, with a practical maximum near
  960px. The video retains a 16:9 aspect ratio, sits inside a restrained gutter,
  uses a modest corner radius, and never exceeds its container.
- Narrow screens: the viewer becomes an edge-to-edge bottom sheet with the same
  hierarchy; video remains 16:9 with a smaller gutter and details scroll below
  it.
- Player chrome: no in-player controls are added by Aska. Provider-specific
  actions stay outside the viewer in the card and context menu.
- Content: player, a gutter-sized gap, title, then a compactly spaced clickable
  channel row when channel data is available. Use the existing resolved
  description only when non-empty; it is best-effort rather than guaranteed.
- Notes: show an always-visible, auto-resizing **Notes** field below the
  metadata. Save after a short idle delay, preserve an unsaved local draft, and
  flush pending edits when the viewer closes or switches video.
- Dismiss via Escape, backdrop click, swipe-down on the mobile drawer, and the
  dialog's standard focus-restoration behavior. Dismissal unmounts the iframe,
  stopping playback.
- Loading/error: show the stored thumbnail as the player backdrop until the
  iframe loads. If the iframe cannot load, retain the title/channel information
  and let the user dismiss the viewer or use the original card/context-menu
  action; do not present the failure as an unfurl error.

## Data contract

`providerExtensions` remains private persistence data. Add an explicitly
allowlisted optional `video` field to the public link-node projection and
client `LinkAsset` type:

```ts
video?: {
  provider: "youtube";
  videoId: string;
  channelName: string | null;
  channelUrl: string | null;
};
```

- The API creates this field only when the persisted resolver key is
  `youtube-oembed` and its stored extension validates against the shape above.
- Do not expose arbitrary provider extensions or oEmbed's `html` field.
- The client constructs the iframe URL from the validated `videoId` only:
  `https://www.youtube-nocookie.com/embed/{videoId}?rel=0&modestbranding=1&playsinline=1`.
- `title`, `previewImage`, `description`, and `originalUrl` continue using the
  existing generic link contract. No schema migration or resolution-job change
  is required.

## Privacy and security

- Add `frame-src https://www.youtube-nocookie.com` to the application CSP; do
  not broaden `default-src` or allow arbitrary iframe origins.
- Use the no-cookie embed origin, `referrerPolicy="strict-origin-when-cross-origin"`,
  `allowFullScreen`, and only YouTube's required media permissions. Do not grant
  autoplay.
- Render title, channel name, and description as text. Validate the video ID
  and channel URL at the server projection boundary before exposing them.
- The embed is a user-initiated third-party request. It is never mounted from a
  passive board render, hover state, prefetch, or background refresh.

## Accessibility

- The card advertises its detail action with an accurate accessible name, for
  example, `Open video details: {title}`.
- The dialog follows the app's standard modal focus trap, has an accessible
  title, and restores focus to the invoking card on close.
- Every icon-only control has a text label; external links state that they open
  YouTube in a new tab.
- Keyboard access covers card activation, opening the external URL, player
  focus, and dismissal. Respect `prefers-reduced-motion` for entry/exit motion.

## Test and acceptance criteria

- API projection tests cover valid YouTube extensions, missing/invalid
  extensions, and the guarantee that raw provider extensions never reach the
  client.
- Client tests cover eligible-card activation, selection-modifier behavior,
  dialog metadata, channel URL, optional description, close/focus restoration,
  and fallback to the old external-link behavior.
- Security-header tests assert the exact no-cookie `frame-src` allowance and
  reject unrelated iframe origins.
- Manual checks: watch, short, and `youtu.be` cards open the same dialog;
  player is paused initially; closing stops playback; a private/deleted video
  still opens its original URL successfully.

## Non-goals

- YouTube Data API integration, API keys, quota management, or guaranteed full
  descriptions.
- Scraping YouTube watch-page data.
- Autoplay, playlist management, saved watch progress, comments, recommendations,
  or channel subscriptions.
- Embedded players for other providers. The public `video` shape may support
  future providers, but no provider behavior is implied by this release.
- Time-coded annotations, transcript highlights, rich-text notes, comments, or
  card-level note previews.
