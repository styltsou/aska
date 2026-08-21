# Background Tasks and Events

Aska uses AWS-native asynchronous work with a small number of stable workload
lanes. A queue is a concurrency, retry, and failure-isolation boundary; it is
not created for every function, provider, or product feature.

## Commands and events

A command asks one owner to perform work. The producer sends it directly to the
owner's SQS queue:

```text
resolve external resource {attemptId, generation}
  -> UrlResolutionQueue -> url-resolution Lambda

render resource media {mediaId, generation}
  -> ImageVariantsQueue -> image-variants Lambda
```

Messages created from database state carry opaque IDs and generations, not
URLs, tenant data, processing profiles, or credentials. The worker makes an
HMAC-authenticated claim through the API immediately before doing work. The API
is authoritative for authorization, current generation, source, and policy.

An event states that something happened and may have multiple independent
consumers. Image uploads already use the only fan-out needed today:

```text
S3 original object created -> ImageUploadTopic (SNS)
  -> ImageVariantsQueue -> image-variants Lambda
  -> ImagePaletteQueue  -> image-palette Lambda
```

SNS gives every subscribed queue its own delivery. Each consumer therefore has
independent concurrency, retries, and a DLQ. Do not attach several specialized
Lambda consumers to one SQS queue: they would compete for messages rather than
receive a copy.

## Current workload lanes

| Lane           | Inputs                                       | Responsibility                                                                       |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| URL resolution | Resource-attempt commands                    | Safely fetch external pages and return normalized metadata and media intents         |
| Image variants | Upload S3 events and resource-media commands | Acquire the source and generate profile-specific WebP variants and blur placeholders |
| Image palette  | Upload S3 events                             | Generate optional search-oriented colour analysis for primary image assets           |

The image-variants worker has source adapters for trusted S3 uploads and
untrusted remote resource media. Both adapters feed the same profile-driven
Sharp processor. Pixel processing does not contain URL resolver or card
rendering logic. Preview and icon profiles never enter palette analysis.

## When to add a queue

Add a new queue only when work needs a meaningfully different owner, compute
profile, concurrency limit, retry policy, latency priority, or failure
isolation. Add a handler/profile to an existing lane when those characteristics
match.

- A new social or publishing resolver belongs in the URL-resolution registry,
  not a new queue.
- A new image rendition policy belongs in the image-variants processor.
- Visual embeddings may belong in the analysis lane or justify a separate lane
  if their compute and provider limits differ substantially.
- Document extraction/indexing will justify its own lane when implemented; it
  is not image or URL-resolution work.

EventBridge and Kafka are intentionally absent. SNS already handles the one
fan-out boundary, and known commands are clearer as direct SQS sends. Revisit a
general event bus only when several independently owned consumers need the same
application-domain events and routing those events directly has become a
measurable coupling problem.

## Delivery invariants

- Every worker assumes at-least-once delivery.
- Writes and callbacks are idempotent.
- Database-backed jobs use generation guards and claims before external work.
- Receive five reports terminal failure (earlier for explicitly non-retryable
  validation failures); receive six retries a failed terminal callback before
  SQS retains the message in the DLQ.
- Remote retrieval uses the shared SSRF-safe fetch implementation.
- Queue bodies and logs must not contain normalized URLs, query strings,
  credentials, metadata bodies, or provider extensions.
- Worker-to-API requests use one `PIPELINE_CALLBACK_SECRET`, while their domain
  claim/result schemas remain separate.
