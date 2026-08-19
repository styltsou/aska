# Image Pipeline Reliability

Image uploads use two independent, at-least-once SQS workflows. The API creates
the `assets`, `image_assets`, and `uploads` rows before the original reaches
S3, so neither processor depends on the other completing first.

An in-place crop reuses this exact workflow. It writes a cropped original to a
fresh storage namespace, immediately switches the asset and its `uploads` row
to that source, and lets the same S3 event fan-out regenerate variants and
palette. It is not a separate crop-processing pipeline.

```txt
browser or remote import -> S3 {workspaceId}/{storageId}/original.* event
                               -> ImageUploadTopic (SNS)
                                   ├-> ImageVariantsQueue -> variants Lambda
                                   └-> ImagePaletteQueue  -> palette Lambda
```

The single S3-to-SNS notification forwards object-created events. SNS fans
them out to both queues, while workers strictly accept only the `original.*`
object in a `{workspaceId}/{storageId}/` namespace. Generated variants are
therefore acknowledged and ignored, preventing recursive processing. The
workers read the same immutable original object identity (object key plus ETag)
but own separate effects:

- The variants worker writes deterministic display and preview WebP objects,
  then marks `image_assets.variant_status` complete.
- The palette worker calculates and persists `image_colors`,
  `dominant_colors`, and `image_assets.palette_status`.

External link previews are deliberately not another SNS subscriber. They have
different trust, retry, and processing semantics and use the dedicated
URL-resolution and resource-media queues. The resource-media processor reuses
the rendition function, but preview images never enter palette extraction.
See [URL Unfurling](./url-unfurling.md).

## Delivery and retries

Both consumers use a batch size of one and report partial batch failures. SQS
redelivers a failed message after the 180-second visibility timeout. The worker
retries processing for the first four receives; on receive five it sends the
matching terminal callback (`image.variants.failed` or
`image.palette.failed`). If that terminal callback cannot reach the API, the
message remains retryable for one more receive and is then retained in that
consumer's DLQ.

This is at-least-once delivery. Duplicate S3 events, SQS deliveries, object
writes, and callbacks are expected. The system is safe because variant keys
are deterministic, palette writes replace the asset's existing colors, and API
callbacks are keyed by original object key and ETag.

During a crop, a callback can arrive just before the short database switch that
registers the new source. The API returns a retriable error in that window;
once the switch commits, the worker retry resolves against the active upload.
Callbacks for a source already listed in cleanup work are ignored.

## Operational model

The two DLQs retain messages for 14 days. An item in either DLQ means the API
could not receive the terminal callback after image processing failed; it needs
investigation and, once understood, replay from the original S3 object.

Pipeline logs include the worker name, source key, SQS receive count, and error
message. Monitor retries and DLQ depth separately for variants and palettes:
a palette incident must not delay rendering or create extra resize work.

## Extending the pipeline

New work that only needs the original upload can receive its own SNS-to-SQS
subscription and run in parallel, just as palette extraction does. The S3
producer remains unchanged; SNS is already the event fan-out boundary.
