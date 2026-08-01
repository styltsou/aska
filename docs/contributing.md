# Contributing to Aska

This guide is for both humans and coding agents. It describes how to orient,
make a focused change, verify it, and leave the repository more understandable
than before.

## First read

1. [System Architecture](./architecture.md) for the implemented topology and
   ownership boundaries.
2. The feature document linked from [Documentation home](./README.md).
3. The nearest code and its tests before changing an interface or behavior.
4. [AWS workflow](./sst-deployment.md) before touching SST, Lambda
   configuration, deployment, or secrets.

Treat root product documents as intent and `docs/` as the maintained guide to
the current implementation. If they disagree, inspect the code, correct the
documentation in the same change, and call out the decision in review.

## Local setup

Use Bun. Dependencies are package-local:

```sh
bun install
cd client && bun install
cd ../server && bun install
cd ../services/image-shared && bun install
cd ../image-variants && bun install
cd ../image-palette && bun install
```

Copy `server/.env.example` to `server/.env` for direct server development and
set the required values. The normal end-to-end path uses real AWS development
resources through the `hybrid` SST Live stage: `bun run dev`. Do not attempt to
emulate the full S3/SNS/SQS pipeline with a direct local server process. For
client-only work against the stable cloud deployment, use `bun run dev:cloud`.
The shared `dev` stage is never a Live stage. See
[AWS workflow](./sst-deployment.md).

## Choose the smallest correct change surface

| If you are changing… | Usually change… | Also check… |
| --- | --- | --- |
| A browser screen or interaction | route, feature component, feature-local API hook | React Query cache transition, accessibility, visual state |
| A public API operation | route, controller, DTO, service | OpenAPI, client feature module, error responses, tests |
| Persistent data | Drizzle schema and migration | service queries, tenant constraints, schema docs, integration tests |
| Collection/canvas behavior | collection service and canvas/board client code | placement/move invariants, [Collection Canvas](./collection-canvas.md), and [Canvas Placement Policy](./placement-policy.md) |
| Image ingestion/enrichment | upload service, callback contract, a worker | idempotency, queue retries, signed callback, pipeline docs |
| Infrastructure/configuration | `sst.config.ts` and environment schema | AWS workflow, secret handling, deployed client origins |
| Logs/traces | logger, tracing middleware, meaningful service boundary | [Observability](./server/observability.md), PII/redaction, sampling |

Avoid broad refactors while delivering a feature unless the refactor is needed
to preserve an invariant or safely implement the feature. Keep unrelated
working-tree changes intact.

## Backend change recipe

1. Define or update the Zod DTO in `server/src/dto/`.
2. Add the route and its middleware in `server/src/routes/`.
3. Keep the controller thin: validate, read auth context, call one service,
   return the standard response envelope.
4. Implement the business operation in a service. Authorize and scope data
   there; use `AppError` for expected failures.
5. Add/update focused unit tests and a database integration test when a real
   query, transaction, or constraint changed.
6. Update `server/src/openapi.json` and any relevant docs.

Do not query Drizzle from a controller, put HTTP types in a service, catch an
`AppError` only to rethrow it, or create ad-hoc service instances outside the
composition root. See the linked server conventions for examples.

## Client change recipe

1. Keep API fetchers, types, hooks, and query keys together under
   `client/src/api/<feature>/`.
2. Use React Query for data from the server. Use Zustand only for non-server
   interaction state that needs to survive across components or local sessions.
3. Put route-specific loading and error behavior in the route/component layer.
4. For a mutation, define the optimistic cache update, rollback, and
   invalidation before writing UI code.
5. Add unit tests for pure transitions, placement algorithms, and cache
   transformations; add a component test only when it protects meaningful UI
   behavior.

The generated `client/src/routeTree.gen.ts` should not be edited by hand. Let
the router/Vite tooling regenerate it when routes change.

## Data and async-work rules

- Every workspace-scoped read and write must enforce the active organization or
  workspace boundary.
- IDs are stable mutation identities; slugs are navigation/read identities.
- Collection positions belong to `collection_nodes`, not assets or folders.
- A folder move or rename must update descendant cached paths transactionally;
  a mixed batch move must either commit every node or roll back every node.
- Image workers expect at-least-once delivery. Make callbacks and writes
  idempotent, then let the shared SQS handler own retry policy.
- Do not store signed S3 URLs. Persist object keys and sign on reads.

## Verification

Run checks only for packages affected by the change, plus every dependent
package whose contract changed. Before merging a cross-cutting feature, run all
four packages:

```sh
cd client && bun run lint && bun run typecheck && bun run format && bun run test && bun run build
cd server && bun run lint && bun run typecheck && bun run lambda:typecheck && bun run format && bun run test
cd services/image-variants && bun run lint && bun run typecheck && bun run format && bun run test
cd services/image-palette && bun run lint && bun run typecheck && bun run format && bun run test
```

For persistence changes, also run integration tests against a disposable
database:

```sh
cd server
TEST_DATABASE_URL=postgresql://... bun run test:integration
```

Do not commit generated migrations without reviewing their SQL. Do not run
destructive database or AWS commands against an unclear target. CI runs the
package quality suites and validates that schema generation leaves no
uncommitted migration.

## Documentation is part of the feature

Update documentation in the same change when a reader would otherwise have to
infer a new behavior from code. At minimum:

- API contract: OpenAPI and the relevant feature doc.
- Schema or invariant: `docs/server/assets-schema.md` and/or
  `docs/server/schema-design-rationale.md`.
- Client interaction/canvas rule: `docs/collection-canvas.md`.
- Pipeline behavior: image-pipeline docs and the AWS workflow if configuration
  changed.
- Logging/tracing: `docs/server/observability.md`.
- New architecture or contributor convention: this guide and the documentation
  home.

Prefer documenting decisions, invariants, ownership, and operational failure
behavior over restating every function. Link to the source-of-truth code path
when it helps a future contributor start quickly.
