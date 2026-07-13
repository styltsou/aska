# Image Pipeline Reliability and Evolution

This document records the reliability model for asynchronous image processing,
the tradeoffs in the current implementation, and the next architecture to adopt
when processing volume or API availability justifies the additional moving
parts.

The Hono API is expected to remain an independently deployed server. The
pipeline therefore uses authenticated HTTPS callbacks rather than Cloudflare
Service Bindings.

## Goals

- Keep browser uploads independent of image-processing duration.
- Preserve work across Worker, API, and network failures.
- Make every state transition observable and recoverable.
- Ensure duplicates cannot create duplicate image assets.
- Avoid repeating CPU-heavy processing merely because the API is temporarily
  unavailable once that cost becomes material.

## Current Architecture

```txt
R2 ingest/ event
  -> image-processing Queue
  -> pipeline Worker: variants + palette
  -> authenticated HTTPS callback to Hono
  -> Hono transaction: upload + asset + palette rows
```

The pipeline Worker acknowledges its source Queue message only after Hono has
accepted the callback. Consequently, an API outage does not lose a completed
processing result: Cloudflare Queues redelivers the source event and the Worker
tries again.

This is an **at-least-once** workflow. A source event, generated R2 objects,
and callback can each occur more than once. The design is safe because:

- variant object keys are deterministic for a storage ID;
- rewriting a variant is harmless;
- Hono identifies the upload by original object key and R2 ETag;
- completed callbacks are idempotent and create no duplicate assets.

Cloudflare Queues provides the durable delivery and retry mechanism. The
Worker's explicit delayed retries control per-message backoff and the point at
which Hono receives a terminal `failed` state. See the [Cloudflare Queues retry
and delay documentation](https://developers.cloudflare.com/queues/configuration/batching-retries/)
for the platform behavior.

## Deliberate Current Tradeoff

The simple topology has one important cost: if variants and palette extraction
succeed but the Hono callback cannot be delivered, a Queue retry runs the image
processor again. It is correct and safe, but may repeat decoding, resizing, and
palette extraction when only the control-plane request failed.

This is an appropriate starting point because it has one Queue, one Worker,
and one idempotent API boundary. It keeps the failure model easy to reason
about while processing volume is low. It is not a loss of Queue reliability;
the Queue is precisely what prevents the callback failure from losing the job.

The tradeoff becomes worth removing when repeated image computation, callback
outages, operational cost, or processing latency become significant.

## Production-Grade Target

At that point, split processing from API finalization with a second durable
Queue:

```txt
R2 ingest/ event
  -> image-processing Queue
  -> processor Worker: variants + palette + completion manifest in R2
  -> image-finalization Queue
  -> finalizer Worker: authenticated HTTPS callback to Hono
  -> Hono transaction: upload + asset + palette rows
```

### Processor Stage

1. Read the original from `ingest/` and generate deterministic variants under
   `assets/{storageId}/`.
2. Write an idempotent completion manifest, for example
   `assets/{storageId}/manifest.json`. It contains original key/ETag, image
   metadata, variants, palette, extraction version, and blur data URL.
3. Publish a small finalization message containing the source identity and
   manifest key to `image-finalization`. A terminal failure event instead
   carries the source identity and bounded error message.
4. Acknowledge the source message only after that publish succeeds.

If the processor is redelivered between any of these steps, it overwrites the
same deterministic objects or emits a duplicate finalization message. Both are
safe. The queue publish is the durability handoff that separates expensive
computation from delivery to Hono.

### Finalizer Stage

1. Read the manifest from R2.
2. Send the signed callback to Hono.
3. Acknowledge the finalization message only after Hono returns success.

An API outage now retries only the finalizer, not Sharp processing. The
finalizer refreshes the callback timestamp and HMAC signature for every
delivery. Hono retains the same idempotency checks because duplicate messages
are expected.

### Failure Policy

- Keep a small, explicit retry budget for processing errors that are unlikely
  to recover, then publish a terminal `failed` finalization event.
- Let the finalization Queue own API-delivery retries independently, with a
  dead-letter queue configured for exhaustion.
- Treat transient responses, timeouts, and `429` responses as retryable.
- Treat invalid callback payloads or unexpected permanent `4xx` responses as
  operational incidents: record them, move the message to the DLQ, and alert.
- Provide a replay command that can re-enqueue a finalization message from its
  manifest without recomputing variants.

## Operational Invariants

The production target enforces these invariants; the current design already
enforces the storage, idempotency, and durable-handoff invariants:

| Invariant                                                                  | Reason                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Original key and ETag identify one processing generation.                  | Prevents an old event from finalizing a replaced source.      |
| Variant and manifest keys are deterministic.                               | Makes retries overwrite-safe and easy to inspect.             |
| Hono completion is idempotent.                                             | Required for at-least-once Queue delivery.                    |
| A message is acknowledged only after its next durable handoff.             | Prevents silent loss between stages.                          |
| Every log, metric, and callback includes the storage ID and original ETag. | Enables tracing and targeted replay.                          |
| DLQ messages are actionable and replayable.                                | Converts an exhausted retry budget into an operable incident. |

## Reconciliation

Even a well-designed at-least-once system needs repair tooling. Run a periodic
reconciliation job that finds uploads stuck in `uploaded` or `processing` past
an expected threshold. It should inspect the original and, when present, the
completion manifest, then either re-enqueue the appropriate source/finalization
message or mark the upload failed with an auditable reason.

Reconciliation is a safety net, not the normal path. Its existence makes the
workflow recoverable after configuration mistakes, accidental Queue deletion,
or manual operational intervention.

## Adoption Trigger

Keep the current one-Queue design until measurements show repeated processing
caused by callback failures or the retry cost is meaningful. Introduce the
finalization Queue when at least one of these is true:

- API availability is materially lower than pipeline availability.
- Image processing is expensive enough that duplicate work affects cost or
  queue latency.
- The service needs a formal DLQ and operator replay workflow.
- Multiple downstream consumers need the completed-image event.

The migration is additive: first introduce manifests and idempotent finalizer
callbacks, then route new completions through the finalization Queue. Existing
source events can continue using the current callback path until the new stage
has been observed in production.
