# Image Pipeline

This Worker owns all CPU-bound image post-processing. It consumes R2 creation
events for `ingest/` objects, writes derived variants under `assets/`, and
signs callbacks to the Hono API which commits the database transaction.

## Configure

Set `PIPELINE_API_BASE_URL` in `wrangler.jsonc` to the externally reachable
Hono API origin for the deployed environment. It must not include `/api/v1`.

Set the same random value in both deployments:

```sh
cd workers/image-pipeline
bunx wrangler secret put PIPELINE_CALLBACK_SECRET
```

Set that value as `IMAGE_PIPELINE_CALLBACK_SECRET` in the Hono server. The
server rejects unsigned, stale, or malformed callbacks.

Create the Queue once, deploy the Worker, then configure one R2 rule that only
matches the ingest namespace:

```sh
bunx wrangler queues create aska-image-processing
bunx wrangler deploy
bunx wrangler r2 bucket notification create aska --event-type object-create --queue aska-image-processing --prefix "ingest/"
```

The prefix filter is required. Worker-generated variants live in `assets/`, so
they cannot create another processing event. The Worker also acknowledges any
unexpected key defensively.

Local `wrangler dev` cannot call a server bound only to localhost from the
Cloudflare runtime. Use a reachable development URL, for example a tunnel.

## Local Checks

```sh
bun install
bun run lint
bun run typecheck
bun run format
bun run test
```

## Failure Lifecycle

The Worker retries ordinary processing failures for the first two deliveries of
an original object. When processing fails on the third delivery, it sends a
signed `failed` callback to the API and acknowledges the message only after
that callback succeeds. The API can then mark the upload as failed, allowing
clients to stop polling rather than remain in `processing` indefinitely.

This is an application-level retry budget, separate from the Queue consumer's
`max_retries` setting. Keep `max_retries` higher than the processing budget:
the additional Queue deliveries are reserved for a failed terminal callback,
such as a temporary API outage. If Queue delivery is exhausted before that
callback is accepted, use a dead-letter queue or operational replay process to
reconcile the affected upload.

For the current delivery guarantees, the intentional callback-retry tradeoff,
and the two-Queue architecture to adopt at higher scale, see [Image Pipeline
Reliability and Evolution](../../docs/server/image-pipeline-reliability.md).

## Result Contract

The Worker emits two WebP variants: `display` at 960px and `preview` at 320px.
Its color extractor stores both coverage (the fraction of source samples) and
salience (coverage plus chroma/accent relevance). Search should rank by color
distance first, then use coverage and salience as secondary ranking signals.
