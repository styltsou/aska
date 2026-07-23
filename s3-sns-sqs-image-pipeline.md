# From One Image Worker to an Event-Driven Image Pipeline

Image uploads look simple at first: upload a file, resize it, extract colours,
and save the result. The complexity appears when the work has different failure
semantics.

For Aska, generating display variants and extracting a search palette both need
the original image, but neither depends on the other. A failed palette should
not make an image unavailable, and retrying palette extraction should not repeat
expensive resizing work.

That led to this architecture:

```text
S3 original upload
  -> SNS topic
      -> variants SQS queue -> variants Lambda -> API callback
      -> palette SQS queue  -> palette Lambda  -> API callback
```

## The tempting design that did not work

The first version attempted to send one S3 `ObjectCreated` event directly to
two SQS queues:

```text
S3 ingest/ upload
  -> VariantsQueue
  -> PaletteQueue
```

AWS rejected that configuration. S3 does not allow overlapping notification
rules for the same event type and object prefix, even when their destinations
are different. Two `ObjectCreated` rules for `ingest/` are ambiguous to S3.

SNS is the small but important missing layer. S3 publishes one notification to
the topic; SNS makes an independent copy for each subscribed queue.

## Why queues sit behind SNS

SNS performs fan-out. SQS performs durable work delivery.

Each worker gets its own queue because it has its own:

- retry budget and dead-letter queue;
- memory, timeout, and concurrency profile;
- operational metrics and failure mode;
- deployment boundary.

The variants worker writes deterministic WebP objects. The palette worker
calculates OKLab colour data and updates colour-search rows. If palette
extraction fails, only its message is retried. Variant generation is untouched.

## Independent results need an independent data model

This only works cleanly because the image asset exists before the upload reaches
S3. The API creates the upload and image-asset records first, with independent
`variantStatus` and `paletteStatus` fields.

That lets either callback arrive first:

```text
palette completes first  -> save palette and mark palette completed
variants complete first -> save variants and mark variants completed
```

There is no orchestration step waiting for both jobs. The UI can render the
original image or completed variants while colour enrichment continues in the
background.

## The SNS envelope is part of the contract

S3 notifications delivered directly to SQS have an S3 event body. SNS wraps
that event before delivering it to each SQS subscription. Consumers therefore
need to unwrap `Message` before reading the S3 records.

It is a small implementation detail, but an easy source of broken consumers
when changing from direct S3-to-SQS delivery to fan-out.

## Retries and terminal state

Both queues process one message per Lambda invocation. A failed message becomes
visible again after its visibility timeout, and each worker reports a terminal
failure only after its own retry budget is exhausted. Dead-letter queues retain
the rare cases where even the terminal callback cannot reach the API.

The important consequence is isolation: an intermittent palette failure cannot
delay the rendered image, and a rendering incident cannot starve colour search.

## When to add more infrastructure

This is not a call to create a queue for every line of code. A separate queue
is useful when work has an independent retry policy, cost profile, or failure
impact. For tightly coupled work with the same ownership and operational needs,
one consumer can remain simpler.

If future image work grows to include OCR, moderation, embeddings, or tagging,
the SNS topic remains the stable fan-out point. New consumers can subscribe
without changing the upload producer or existing workers.

The design is deliberately modest: one S3 notification, one SNS topic, two
queues, two workers, and an idempotent API callback. It is enough structure to
make failures independent without turning an image upload into a workflow
engine.
