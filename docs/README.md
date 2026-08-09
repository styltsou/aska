# Aska Documentation

This directory is the maintained context for both contributors and coding
agents. It explains the implemented system, its invariants, and how to change
it safely. Start here rather than reconstructing architecture from file names.

## Start here

1. [System Architecture](./architecture.md) — implemented topology, package
   ownership, request/data flows, and hard boundaries.
2. [Contributing to Aska](./contributing.md) — setup, feature recipes,
   verification, and documentation expectations.
3. [AWS workflow](./sst-deployment.md) — real AWS `dev` workflow, stages,
   secrets, hosting, and deployment.
4. [Cloudflare Tunnel Hybrid Development](./cloudflare-tunnel-hybrid-development.md)
   — deferred personal HTTPS/Vite workflow for browser and image-upload work.
5. [Development Workflow](./development-workflow.md) — tests, formatting, and
   package-local quality checks.

## Product and client behavior

- [Board Product Specification](../BOARD_PRODUCT_SPEC.md) — product direction.
- [Collection Canvas Architecture](./collection-canvas.md) — spatial canvas,
  placement, movement, and cache behavior.
- [Canvas Placement Policy](./placement-policy.md) — insertion and folder-move
  placement contexts, collision handling, and batch rules.
- [Color Image Search](./color-image-search.md) — shipped retrieval behavior
  and ranking boundaries.

Unbuilt or partially built specs and plans (previously here: spring-loaded
folder navigation, premium interaction ideas, color-based image search plan)
live in `../specs/` — a git-ignored directory for near-future work. Linking is
one-directional: specs may reference these docs, but the maintained docs never
link back out to `specs/`.

## Server, data, and operations

- [Server Guide](./server/index.md) — API layers, composition, request flow,
  environment, and local checks.
- [Controller Pattern](./server/controller-pattern.md) and
  [Service Method Pattern](./server/service-method-pattern.md) — endpoint
  implementation conventions.
- [Error Handling](./server/error-handling.md) — response/error contract.
- [Assets Schema](./server/assets-schema.md) and
  [Schema Design Rationale](./server/schema-design-rationale.md) — data model
  and tenant/collection invariants.
- [Image Upload and Processing Pipeline](./server/image-upload-implementation-plan.md)
  and [Image Pipeline Reliability](./server/image-pipeline-reliability.md) —
  browser-to-S3 ingestion, asynchronous work, retries, and callbacks.
- [Image Cropping](./server/image-cropping.md) — in-place source replacement,
  normal pipeline reuse, and cleanup outbox behavior.
- [Image Delivery Architecture](./image-delivery-architecture.md) — private,
  workspace-scoped CloudFront delivery for originals and generated renditions
  with stable URLs backed by immutable S3 keys.
- [Observability](./server/observability.md) — Sentry errors, traces, logs,
  metrics, replay, source maps, and privacy policy.
- [Scaffold Recipes](./server/scaffold-recipes.md) — repeatable backend work.

## Documentation standard

Docs must stay useful without a guided code tour. When behavior changes, update
the relevant decision/invariant document and this index if navigation changes.
Document what exists today; label plans explicitly. Keep sensitive values out
of docs and point to environment-variable names or SST secret names instead.
