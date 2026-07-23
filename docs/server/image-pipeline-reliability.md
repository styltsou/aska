# Image Pipeline Reliability

Image uploads use two independent, at-least-once SQS workflows. The API creates
the `assets`, `image_assets`, and `uploads` rows before the original reaches
S3, so neither processor depends on the other completing first.

```txt
browser or remote import -> S3 ingest/ object-created event
                               ├-> ImageVariantsQueue -> variants Lambda
                               └-> ImagePaletteQueue  -> palette Lambda
```

Both notifications are filtered to the `ingest/` prefix. The workers read the
same immutable original object identity (object key plus ETag) but own separate
effects:

- The variants worker writes deterministic display and preview WebP objects,
  then marks `image_assets.variant_status` complete.
- The palette worker calculates and persists `image_colors`,
  `dominant_colors`, and `image_assets.palette_status`.

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

## Operational model

The two DLQs retain messages for 14 days. An item in either DLQ means the API
could not receive the terminal callback after image processing failed; it needs
investigation and, once understood, replay from the original S3 object.

Pipeline logs include the worker name, source key, SQS receive count, and error
message. Monitor retries and DLQ depth separately for variants and palettes:
a palette incident must not delay rendering or create extra resize work.

## Extending the pipeline

New work that only needs the original upload can receive its own S3-to-SQS
notification and run in parallel, just as palette extraction does. Introduce
an event bus only when several independent consumers make direct notification
rules hard to manage or when routing needs content-based rules. It is not
needed for the current two-worker topology.
