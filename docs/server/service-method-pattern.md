# Service Method Pattern

Services own business operations. A service method should read like the complete
application workflow for one operation: authorize, load state, enforce
invariants, write, and return typed data.

## Method Order

Use this order unless the operation has a specific reason to differ:

1. Normalize trusted inputs only if needed.
2. Assert workspace membership, role, or permission.
3. Load existing records needed for decisions.
4. Throw `AppError` for not found, conflict, forbidden, or invalid business
   state.
5. Enforce uniqueness and domain invariants.
6. Build explicit insert/update payloads.
7. Execute Drizzle query.
8. Return typed rows or projections.

## Rules

- Services do not return HTTP responses.
- Services do not read Hono context.
- Services do not catch their own `AppError`s.
- Services use injected dependencies from `this.deps`.
- Services use `first(...)` or `firstOrThrow(...)` for single-row results.
- Services prefer explicit update payloads over spreading partial DTOs into
  Drizzle `.set(...)`.

## Type Sources

- Request input types come from Zod DTOs: `z.infer<typeof Schema>`.
- Database row types come from Drizzle inferred models.
- Response projection types can use `Pick`, `Omit`, or small composed aliases.

Keep each service interface in the same file as its implementation.
