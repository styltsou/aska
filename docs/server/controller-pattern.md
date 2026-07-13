# Controller Pattern

Controllers are HTTP adapters. They validate request parts, read authenticated
context, call services, and return typed response envelopes.

## Standard Shape

```typescript
export const createCollection = factory.createHandlers(
  validate.param(WorkspaceParamSchema),
  validate.body(CreateCollectionSchema),
  async (c) => {
    const { workspaceId } = c.req.valid("param");
    const data = c.req.valid("json");

    const collection = await collectionService.createCollection(
      workspaceId,
      c.get("userId"),
      data,
    );

    return c.json(success(collection), 201);
  },
);
```

## Rules

- Use `factory.createHandlers(...)`.
- Use `validate.param`, `validate.query`, and `validate.body`.
- Read validated data with `c.req.valid(...)`.
- Read auth context with `c.get(...)` once auth middleware exists for protected
  API routes.
- Return `success(...)` for successful JSON responses.
- Return `c.body(null, 204)` for no-content deletes.
- Do not query Drizzle from controllers.
- Do not put business rules in controllers.
- Do not catch normal service errors.

## Service Resolution

Resolve services once at module scope:

```typescript
const collectionService = container.cradle.collectionService;
```

Do not create service instances manually in controllers.

## Authenticated Internal Callbacks

Some internal machine-to-machine routes cannot use `authMiddleware`. The image
pipeline callback is the current example: it reads the raw request body, verifies
an HMAC signature and timestamp, parses the body with its dedicated Zod schema,
then calls the service. Keep that authentication and parsing boundary in the
controller; the service receives only validated callback data.

Do not route signed callbacks through generic JSON body middleware before
verification, because the signature is defined over the original raw payload.
