# Aska Server

The server is a Bun + Hono API using Drizzle, Postgres, Better Auth, and Zod.

```sh
bun install
bun run dev
```

The API runs at `http://localhost:3000` by default.

## Quality Checks

```sh
bun run lint
bun run typecheck
bun run format
bun run test
```

## Database Integration Tests

Integration tests are intentionally separate from the fast unit suite because
they create and clean up real database fixtures. Point `TEST_DATABASE_URL` at
a disposable database before running them:

```sh
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/aska_test bun run test:integration
```

## Database

Schema changes belong in `src/db/schema`. Generate and review a Drizzle
migration, then apply it deliberately:

```sh
bun run db:generate
bun run db:migrate
```

`collection_nodes.node_type` distinguishes asset and folder placements. Counts
are descendant asset counts, backed by the `(collection_id, node_type)` index
and cached folder paths. Canvas positions are signed integer coordinates stored
as a nullable pair on each placement. See
[Assets Schema](../docs/server/assets-schema.md) and
[Collection Canvas Architecture](../docs/collection-canvas.md) for details.

## Useful Endpoints

```txt
GET /health
GET /openapi.json
GET /docs
```

## Image pipeline

Image uploads are finalized asynchronously by `../workers/image-pipeline`.
Set `IMAGE_PIPELINE_CALLBACK_SECRET` to the same value as the Worker secret
before deploying either service. The Worker setup, R2 notification rule, and
object-key namespaces are documented in
[`../workers/image-pipeline/README.md`](../workers/image-pipeline/README.md).
