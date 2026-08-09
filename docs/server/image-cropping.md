# Image Cropping

Cropping replaces an image asset in place. It does not create a copy, preserve
an original master, or record crop history. Undo and redo belong to a future
board-wide operation system and are intentionally not part of image cropping.

## Generation replacement

An asset has one active media generation. Its source and derived files use the
standard immutable namespace:

```text
{workspaceId}/{storageId}/original.{extension}
{workspaceId}/{storageId}/display.webp
{workspaceId}/{storageId}/preview.webp
```

The asset ID remains stable across a crop. The crop receives a new `storageId`,
so it gets new immutable URLs while continuing to represent the same asset
everywhere on the board.

## Request flow

1. The crop editor generates a browser-only preview and submits integer source
   pixels to `POST /workspace/:workspaceSlug/images/:assetId/crop`.
2. The API validates authorization, completion state, and crop bounds against
   the current original. It uses Sharp to encode a cropped `original.webp`.
3. It writes that object under a fresh storage namespace.
4. A database transaction switches the image and associated `uploads` workflow
   row to the new source, resets variants/palette state, clears old colors, and
   writes a cleanup job for the exact displaced keys.
5. The response immediately returns the cropped original. S3 creation then
   triggers the existing variants and palette workers, just as a normal upload
   does.

The client can show the cropped original while display/preview/blur and palette
work completes. Derived rendering and palette extraction are independent.

## Cleanup outbox

S3 deletion cannot be included in the Postgres transaction. `media_cleanup_jobs`
is therefore an outbox for obsolete object keys only; it is not edit history.

`sst.aws.CronV2` provisions an EventBridge Scheduler invocation every five
minutes for the cleanup Lambda. It claims due jobs, deletes their S3 objects,
and removes successful jobs. Failures back off exponentially, and a claim older
than ten minutes can be reclaimed after an interrupted invocation. The job's
asset reference is nullable so asset deletion cannot cancel cleanup for an
already displaced generation.

## Invariants

- Never overwrite an existing media key.
- The active `original` is both the crop source and the immediate fallback while
  derived variants process.
- A crop rejects an image that is still processing.
- Concurrent crop attempts serialize on the image row; a stale attempt fails
  rather than replacing a newer source.
- Displaced objects are retried until deletion succeeds.
