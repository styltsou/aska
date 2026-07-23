# Scaffold Recipes

Use these recipes when adding backend functionality.

## Add A Protected Endpoint

1. Add request schemas in `server/src/dto/<feature>.dto.ts`.
2. Add service methods in `server/src/services/<feature>.service.ts`, following
   [Service Method Pattern](./service-method-pattern.md).
3. Construct the service explicitly in `server/src/container.ts`, passing its
   dependencies to the constructor.
4. Add controller handlers in `server/src/controllers/<feature>.controller.ts`,
   following [Controller Pattern](./controller-pattern.md).
5. Add `authMiddleware` to protected controller handlers.
6. Add route wiring in `server/src/routes`, chaining Hono route calls and
   assigning the returned app value.
7. Update `server/src/openapi.json`.
8. Run `bun run lint && bun run typecheck && bun run format && bun run test`.

## Add A Database Table

1. Add the table in `server/src/db/schema/<area>.ts`.
2. Export it from `server/src/db/schema/index.ts`.
3. Use Drizzle-inferred types in services.
4. Generate and review a migration with `bun run db:generate` before applying
   it with `bun run db:migrate`.
5. Update `docs/server/assets-schema.md` and
   `docs/server/schema-design-rationale.md` when the data-model contract
   changes.

## Add Or Change An API Response

1. Change service/controller code.
2. Update the response schema in `server/src/openapi.json`.
3. Update examples in docs if the response is part of a documented convention.
4. Run `bun run lint && bun run typecheck && bun run format && bun run test`.

## Add A New Convention

Add a short doc under `docs/server` or `docs/` and link it from
`docs/server/index.md`. The docs directory is shared context for engineers and
coding agents.

## Add An Asynchronous Media Pipeline

1. Keep the request-facing API responsible for authorization and durable upload
   state; do not move collection writes into the Worker.
2. Use distinct S3 prefixes for source objects and generated objects.
3. Configure S3 event notifications with the source prefix only, and give
   independent processors separate queues when their retry behavior differs.
4. Authenticate Worker callbacks over the raw payload and make the persistence
   transaction idempotent.
5. Persist search-oriented extraction data independently from UI display caches.
6. Expose a scoped status endpoint and have the client wait for completion.
7. Document secrets, notification rules, retries, and local development access.

Use [Image Upload and Processing Pipeline](./image-upload-implementation-plan.md)
as the concrete reference implementation.
