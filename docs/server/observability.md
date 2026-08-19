# Observability

Sentry is the application observability backend for the React client, Hono API,
and asynchronous worker Lambdas. It owns error grouping, distributed traces,
structured logs, custom metrics, release context, and error-triggered browser
session replay. CloudWatch still receives single-line JSON logs from the server
and workers as a deployment-level fallback.

## Why Sentry

This project intentionally uses Sentry instead of operating a separate
OpenTelemetry collector and Grafana stack. For a small product, Sentry combines
actionable error grouping, browser replay, traces, logs, metrics, alerts, and
release context in one workflow, with no telemetry backend to provision or
tune. OpenTelemetry remains a good choice when vendor-neutral telemetry,
multiple backends, or organization-wide collector policies are requirements;
they are not requirements for this application today.

## Runtime coverage

- The React client uses `@sentry/react`, React 19 error hooks, and the TanStack
  Router tracing integration. Browser traces propagate to the API with
  `sentry-trace` and `baggage` headers.
- The API initializes `@sentry/hono/node`, installs Sentry as the first Hono
  middleware, and wraps its AWS entrypoint with `@sentry/aws-serverless`.
- Each SQS worker initializes `@sentry/aws-serverless`, wraps its Lambda handler,
  and creates a consumer span around every message-processing attempt.
- Caught worker failures are explicitly captured because returning an SQS
  partial-batch failure is intentional retry behavior, not an uncaught throw.

All three runtimes use the same release value when one is supplied. Events are
tagged with `service=aska-client`, `aska-api`, `image-variants`, or
`image-palette`, `url-resolution`, or `resource-media`, so one Sentry project
remains practical for this application.

## Configuration

Sentry is disabled when its DSN is absent. Local structured logs continue to
work without it.

```dotenv
SENTRY_DSN=https://public-key@o0.ingest.sentry.io/project-id
SENTRY_SERVICE=aska-api
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=aska@<git-sha>
SENTRY_TRACES_SAMPLE_RATE=0.2
```

The browser uses the corresponding `VITE_SENTRY_*` variables documented in
`client/.env.example`. SST injects the stage-scoped `SentryDsn` secret into the
API, workers, and client build. The DSN is a routing identifier and is expected
to appear in the browser bundle; the source-map auth token is not.

For a release deployment, export one release identifier for all runtimes:

```sh
SENTRY_RELEASE="aska@$(git rev-parse HEAD)" bun run deploy
```

The Vite build uploads hidden source maps only when all three build-only values
are present:

```dotenv
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxx
SENTRY_ORG=your-org
SENTRY_PROJECT=aska
```

Never prefix the auth token with `VITE_` or store it in a checked-in file. After
upload, the plugin removes source maps from `client/dist`. Lambda bundles include
source maps and run Node with `--enable-source-maps` so server stack traces refer
to TypeScript sources.

## Sampling and replay

Traces default to a `0.2` sample rate in every runtime and can be tuned with
`SENTRY_TRACES_SAMPLE_RATE` / `VITE_SENTRY_TRACES_SAMPLE_RATE`. Error events are
not controlled by the trace sample rate. Browser replay records no ordinary
sessions and captures only sessions associated with an error. Replay masks all
text and blocks all media.

## Privacy boundary

The SDK configuration disables automatic collection of cookies, HTTP headers,
request/response bodies, query parameters, database values, local variables,
GraphQL payloads, and generative-AI inputs/outputs. Authenticated user context
contains only the internal user ID. Do not attach names, email addresses,
tokens, image contents, note contents, or complete domain objects to Sentry.

Application log metadata is sanitized before it reaches Sentry or stdout. Keys
that resemble authorization headers, cookies, passwords, secrets, tokens, API
keys, or credentials are redacted. This sanitizer is a final guardrail, not
permission to log sensitive payloads.

URL workers additionally prohibit logging normalized/source URLs, query
strings, remote headers or bodies, parsed metadata, and provider extensions.
Use resource/attempt/media IDs, resolver versions, processing profiles, status
classes, and bounded failure categories instead.

## Logging

Every completed API request emits one structured record with its request ID,
route template, status, duration, severity, and active Sentry trace IDs. Success
logs are sampled deterministically with `LOG_SUCCESS_SAMPLE_RATIO`; 4xx/5xx and
slow requests are retained. Health checks are debug-level only.

Use `LoggerService` in the API and `log` from the shared image-worker module.
Log important domain outcomes, state transitions, retries, and dependency
failures. Prefer stable identifiers and counts over full objects. Do not add
method-entry or method-exit logs.

## Spans, errors, and metrics

Use `Sentry.startSpan` for a costly operation or an external boundary whose
duration helps diagnose a request. Give spans a stable low-cardinality name and
operation, and keep attributes limited to non-sensitive strings, numbers, and
booleans. Normal service method calls do not need spans.

Unexpected API errors are captured by the Hono integration. Lambda-level
failures and timeouts are captured by the AWS wrapper. If code deliberately
catches a failure and converts it into retry state or another successful return,
call `Sentry.captureException` explicitly so the failure still creates an issue.

The workers publish `sqs.message.duration` as a Sentry distribution metric with
`queue` and `outcome` attributes. Prefer trace-derived performance metrics for
HTTP operations. Add a custom metric only when it represents a durable product
or operational signal that cannot be answered from spans or logs.

The browser also records low-cardinality image-delivery metrics from
`ProgressiveImage` when Sentry is enabled:

- `image.delivery.decoded` and `image.delivery.failed` count decode successes
  and load failures.
- `image.delivery.decode_duration`, `image.delivery.resource_duration`, and
  `image.delivery.transfer_bytes` measure decode and resource timing.
- `image.delivery.intrinsic_to_rendered_width` measures the delivered image's
  intrinsic width relative to its rendered width.

These metrics use only delivery host, rendition, loading mode, cache warmth,
and resource-timing state as attributes. They do not attach the image URL or
image contents. Cross-origin media resource timing is available only when the
media distribution exposes the deployed client origin through
`Timing-Allow-Origin`; see [Image Delivery Architecture](../image-delivery-architecture.md).
