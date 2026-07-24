# Observability

The API emits one structured JSON event per completed request. It does not log
request starts, request bodies, query strings, authorization headers, cookies,
raw URL paths, or normal service-method calls. This keeps the useful signal in
CloudWatch, Loki, or any JSON log collector without exposing credentials or
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

## OpenTelemetry traces

Set these Lambda environment variables to export the HTTP server span to any
OTLP/HTTP collector. The traces use W3C `traceparent` propagation and logs carry
the same trace ID, so Grafana can navigate between a request log and its trace.

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=aska-api
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://<collector>/v1/traces
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-instance-id:token>
OTEL_TRACES_SAMPLE_RATIO=0.1
```

`sst.config.ts` forwards those variables from the environment that runs
`bun run deploy`; it leaves tracing disabled when `OTEL_ENABLED` is absent.
Store the authorization value in your CI secret store rather than a checked-in
environment file.

For Grafana Cloud, use the OTLP gateway URL and credentials shown in its stack's
OpenTelemetry setup page. For self-hosted Grafana, point the API at Grafana
Alloy (or another OpenTelemetry Collector), then have that collector send traces
to Tempo and JSON logs to Loki. Keeping the collector outside the application
makes the logging and tracing code portable.

The Lambda wrapper flushes spans before an invocation completes. If the
collector is unavailable, the request still succeeds and an error is written to
stdout. Use a short network path—normally a collector or ADOT extension in the
same AWS environment—for the exporter endpoint.
