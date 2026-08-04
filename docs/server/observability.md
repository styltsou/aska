# Observability

The API emits OpenTelemetry traces, metrics, and logs. Request logs are
structured OTLP log records that share a trace context with the HTTP span; they
do not log
request starts, request bodies, query strings, authorization headers, cookies,
raw URL paths, or normal service-method calls. This keeps the useful signal in
Loki, CloudWatch, or any OTLP log collector without exposing credentials or
creating a second copy of user data.

Every request log includes `request_id`, `trace_id`, `span_id`, method, route,
HTTP status, and duration. Errors include a serialized exception; metadata keys
that look like credentials are redacted before output. Successful requests are
sampled deterministically with `LOG_SUCCESS_SAMPLE_RATIO`; 4xx/5xx and slow
requests are never sampled out. Health checks are debug-level only.

Use service logs only for an important domain outcome, a state transition, a
retry, or an external dependency failure. Include stable identifiers and counts
instead of full payloads. The existing color-search completion event is the
intended shape.

## OpenTelemetry traces and logs

Set these Lambda environment variables to export the HTTP server span and log
records to any OTLP/HTTP collector. The traces use W3C `traceparent`
propagation and log records carry the same trace context, so Grafana can
navigate between a request log and its trace.

```dotenv
OTEL_SERVICE_NAME=aska-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://<collector>
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64-instance-id:token>
OTEL_TRACES_SAMPLE_RATIO=0.1
```

`server/.env` configures local API development. The deployed `dev` stage uses
the Grafana endpoint declared in `sst.config.ts` and the stage-scoped
`GrafanaOtlpHeaders` SST secret, which is injected into the API and both
image-processing worker Lambdas (`image-variants` and `image-palette`). CI
never receives those runtime values. The header value must be percent-encoded
(`%20` for the space in `Basic <token>`), per the OTel spec; the exporters
decode it before sending. Never put the authorization value in a checked-in
environment file.

For Grafana Cloud, use the OTLP gateway URL and credentials shown in its stack's
OpenTelemetry setup page. For self-hosted Grafana, point the API at Grafana
Alloy (or another OpenTelemetry Collector), then have that collector send traces
to Tempo and logs to Loki. Keeping the collector outside the application makes
the logging and tracing code portable.

To enable export, configure the OTLP base endpoint. When no endpoint is
configured, log records are still emitted through the OTel Logs SDK but written
to stdout as single-line JSON. Every recorded trace, log, and metric is exported
through the derived signal endpoint, so there is no separate on/off flag to
forget. The Lambda wrapper flushes spans and log records before an invocation
completes. If the collector is unavailable, the request still succeeds and an
error is written to stdout. Use a short network path—normally a collector or
ADOT extension in the same AWS environment—for the exporter endpoint.

## Metrics

Metrics are exported as OTLP/HTTP to the derived `/v1/metrics` endpoint
whenever `OTEL_EXPORTER_OTLP_ENDPOINT` is configured. They are
flushed alongside spans and logs before a Lambda invocation completes, so
records reach the collector even on short-lived requests. If that endpoint is
absent, a meter provider is still registered so the automatic undici histogram
below resolves to a real instrument, but its records are simply discarded.

What is exported today:

- `http.server.request.duration` (histogram, seconds) — one record per API
  request, with `http.request.method`, `http.response.status_code`, and
  `http.route` attributes. Recorded in `traceRequest`.
- `http.client.request.duration` (histogram, ms) — recorded automatically by
  `@opentelemetry/instrumentation-undici` for every outbound `fetch` once the
  meter provider is registered; no additional code needed.
- `sqs.message.duration` (histogram, ms) — one record per SQS message processed
  by an image worker, with `queue` (`palette` or `variants`) and `outcome`
  (`success` or `error`) attributes. Recorded by `createSqsHandler`.

There is no Prometheus endpoint: the Lambdas are short-lived and push metrics
only during an invocation. Point the endpoint at Grafana Cloud, Grafana Alloy,
or any OTLP/HTTP metrics collector.

### Adding a metric

Follow these rules when adding a metric.

- **Resolve the meter at call time.** `metrics.getMeter(...)` reads the global
  provider on every call, so a histogram created at module scope would bind to
  the no-op provider if the module loads before `initializeMetrics`. Create the
  instrument inside the function that records, or lazily after initialization.
- **Name instruments with dot-separated units** (`<domain>.<resource>.<unit>`),
  set a `description`, and record `ValueType.DOUBLE` for durations measured in
  milliseconds or seconds.
- **Record after the work finishes** (in a `finally`, like spans) so errors do
  not skip the measurement, and include a status attribute
  (`outcome="success" | "error"`) so the ratio of failures is queryable.
- In the server, add helpers to `server/src/observability/metrics.ts` and call
  them from the point of measurement. In workers, add them to
  `services/image-shared/src/observability.ts`. Never put credentials, tokens,
  or request bodies in metric attributes.

## Image workers

Each SQS consumer runs its `initializeObservability` at module load, wraps every
message in a consumer span (`messaging.system=aws_sqs`), and flushes all
exporters before the invocation returns. Worker logs go through the same OTel
Logs SDK and carry the message's trace context.

## Automatic instrumentation

Both the API and the image workers register `@opentelemetry/instrumentation-undici`
whenever an OTLP base endpoint is configured. It instruments Node's built-in global `fetch` through
`diagnostics_channel` subscriptions, so every outbound HTTP call made with
`fetch` — remote image downloads, pipeline callbacks, Resend, Better Auth —
becomes a client span under the request or consumer span. It is intentionally
the only auto-instrumentation:

- `@opentelemetry/instrumentation-aws-sdk` patches `@aws-sdk/*` at require time,
  but the Lambda bundles inline that dependency, so the hooks never fire.
- `@opentelemetry/instrumentation-http` would also wrap the OTLP exporter's own
  requests and create noisy self-instrumentation.
- Drizzle's built-in OTel support is a disabled stub in the pinned
  `drizzle-orm@1.0.0-rc.4`, so DB calls are not traced automatically.

That leaves two meaningful boundaries without automatic coverage — S3 and the
database. Wrap them in a child span only where it helps find the root cause,
e.g. an image download or a slow query. Everything else should stay
uninstrumented: adding spans to normal service-method calls just raises noise.

## Instrumenting new code

Follow these rules when adding manual instrumentation.

**Span or log?** Use a span when you want to measure a duration, see it on a
waterfall, or attach its errors to a trace — typically an external dependency
(S3, the database) or a costly operation. Use a log for a domain outcome, a
state transition, a retry, or a failure that should be searchable as a record.
Do not log things that are already visible as a span.

**Spans.** In the server, start a span from the `tracer` in
`server/src/observability/tracing.ts` (`trace.getTracer("aska.api")`); it is
automatically a child of the HTTP span when created inside the request handler.
In workers, use `runWithSpan` from `services/image-shared/src/observability.ts`.
Name spans `<verb or domain>.<resource>` (e.g. `image-upload.fetch-source`,
`s3.get-object`), set `SpanKind.CLIENT` for outbound calls, and end the span in
a `finally` so errors never leave it open. Never put credentials, tokens, or
request bodies in attributes.

**Logs.** Use `LoggerService` in the server and `log` in the shared worker
module. Keep payloads small: stable identifiers and counts, not full objects.
The sanitizer redacts any attribute whose key looks like an authorization
header, cookie, password, secret, token, or API key; do not rely on it as the
only defense.

**Attributes.** Prefer the OpenTelemetry semantic-convention names where they
exist (`http.response.status_code`, `messaging.system`, `error.type`). The
default redaction rules already protect the span; follow the same boundaries
for any attribute you add.
