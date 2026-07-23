# Image pipeline

This is an AWS Lambda. Only S3 `ingest/` object-created events
are delivered directly to SQS; Lambda consumes the queue, creates WebP variants under
`assets/`, and sends a signed callback to the Hono API.

The SQS retry policy and dead-letter queue are defined in the root
[`sst.config.ts`](../../sst.config.ts). See
[`SST_DEPLOYMENT.md`](../../SST_DEPLOYMENT.md) for local invocation and deploy
instructions.
