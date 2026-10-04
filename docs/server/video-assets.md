# Video assets (v1)

Video is a first-class asset in collections and the inbox. A user can upload a
local file or import a public, direct file URL. Pasting a URL whose pathname
ends in `.mp4` or `.webm` selects the video import path. The unified Upload
dialog accepts mixed local images and videos and classifies direct URLs using
a safe server-side content-type check, including URLs without file suffixes.
Provider pages, embeds, HLS/DASH, and transcoding are out of scope.

## Accepted media

- Up to 250 MiB, including remote imports.
- MP4 with one H.264 4:2:0 video track and optional AAC audio.
- WebM with one VP8/VP9 4:2:0 video track and optional Opus/Vorbis audio.
- At most one audio track. The worker probes the actual streams; file names and
  declared MIME types are not sufficient validation.

The original is never transcoded. The viewer uses a custom player over the
native HTML video element, while cards show a poster, duration, and a delayed
muted hover preview.
The processor samples early frames and writes native-resolution `poster.webp`
plus `poster-display.webp` (maximum 960 px width) and
`poster-preview.webp` (maximum 320 px width). All renditions are WebP and
never enlarged. The database calls these `original`, `display`, and `preview`.
The worker also samples up to 100 frames across the video and packs them into
`storyboard.webp` for seek-bar hover previews. Frame layout metadata is stored
with the asset. Storyboard extraction is best-effort, so a video remains playable
if preview generation times out or fails.

Older completed videos can be queued for storyboard generation with
`sst shell -- bun run --cwd server backfill:video-storyboards --enqueue` after
the migration and worker deployment. Omit `--enqueue` to inspect the count.

## Storage and lifecycle

All video objects are private and keyed under
`{workspaceId}/video/{storageId}/`. The original is `original.mp4` or
`original.webm`; the three posters and storyboard sheet live beside it.
Workspace-scoped CloudFront cookies cover the same `{workspaceId}/*`
authorization prefix used by images.
Local/hybrid mode falls back to presigned S3 reads. A separate presigned S3
attachment URL handles full-size downloads without streaming 250 MiB through
the API.

Creating a video inserts its asset and placement immediately. The card is
shown while its `video_uploads` workflow is `pending`, `uploaded`, or
`processing`. Browser and remote S3 PUTs are conditional (`If-None-Match: *`),
so an original cannot be replaced after validation. A browser upload PUT to
S3, or a queued remote fetch followed by
S3 PUT, triggers the video worker through the assets SNS topic and video SQS
queue. Signed internal callbacks update status and metadata. On success, the
card becomes playable. On a terminal error, the card remains visible with an
error and can be removed; the worker removes rejected original, poster, and
storyboard objects.
Stale workflows are marked failed by the existing scheduled cleanup Lambda.

Remote fetches reject non-public network destinations (including redirects and
DNS answers that resolve to private IPs), unsupported response MIME types,
empty responses, and responses exceeding the byte cap. The importer streams
to disk instead of holding the body in memory. A failed remote URL is not
silently turned into a generic link.

## Rollout and smoke test

The CI deployment for shared `dev` installs the video processor dependencies,
applies the video asset and storyboard migrations, then deploys the API, client, queue,
worker, and SNS subscription. No manual S3 folder or CloudFront policy change
is required. The video worker bundle must contain executable FFmpeg; packaging
and actual S3/SQS callback delivery need a cloud
smoke test before calling the feature deployed.

1. Upload a short H.264/AAC MP4 and a VP8/VP9 WebM to both a collection and
   the inbox. Confirm the pending card becomes a poster card and opens in the
   player; hover and scrub the seek bar, download, add a note, move, and delete it.
2. Import a direct public MP4/WebM URL and verify the resulting object key is
   inside the workspace video namespace, not a hotlink to the source.
3. Try a provider page, private-network URL, unsupported codec, and oversized
   file. Verify a useful failed card remains removable and no rejected object
   is retained.
4. Verify another workspace cannot read the video's original, posters, or
   storyboard and that deleting a video removes all of them.

There is no production deployment stage configured. Do not use `sst dev` on
the shared `dev` stage; use `hybrid` for live-forwarded local development.
