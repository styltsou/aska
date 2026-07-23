# Server Guide

The server is a Bun + Hono API with Better Auth, Drizzle ORM, Zod validation,
OpenAPI documentation, and Scalar API docs.

## Runtime Shape

- `server/src/app.ts`: Hono app, global middleware, health, auth, OpenAPI,
  Scalar, and API route mounting.
- `server/src/index.ts`: Bun local-development entrypoint.
- `server/src/lambda.ts`: AWS Lambda handler entrypoint.
- `server/src/routes`: route grouping.
- `server/src/controllers`: HTTP adapters.
- `server/src/services`: business operations and feature-local helpers such as
  repositories, resolvers, mappers, and finalizers.
- `server/src/dto`: Zod request schemas and inferred request types.
- `server/src/db/schema`: Drizzle schema and inferred database row types.
- `server/src/lib`: shared backend primitives and reusable feature libraries.
- `server/src/openapi.json`: source-controlled OpenAPI document.

## Core Conventions

- Keep the backend TypeScript config strict.
- Do not use a domain layer by default.
- Use Drizzle inferred row types for database models.
- Use Zod `z.infer` for request DTO types.
- `server/src/container.ts` is the composition root: explicitly construct shared
  dependencies once and export the resulting `container` object.
- Chain Hono route registration and assign the returned app value so exported
  route types carry endpoint schemas.
- Services own business logic and database queries.
- Controllers validate requests, call services, and return HTTP responses.
- Controllers do not catch normal service errors; `server/src/app.ts` has the
  global error handler.
- Protected API routes use `authMiddleware`, which reads Better Auth sessions
  and throws `AppError` for unauthorized requests.
- Successful JSON responses use `success(...)`.
- Errors use `errorResponse(...)`.
- Every API change updates `server/src/openapi.json`.

## Service Composition

The server uses manual dependency injection. `server/src/container.ts` creates
the object graph explicitly, in dependency order, and exports the shared
instances:

```ts
const loggerService = new LoggerService();
const objectStorageService = new ObjectStorageService();

export const container = {
  loggerService,
  objectStorageService,
  assetService: new AssetService({ objectStorageService }),
};
```

Add a service there when it is shared by application code. Pass its dependencies
to its constructor directly; do not add a DI framework or resolve dependencies
dynamically. Controllers import `container` and select the services they use.
Tests should construct the service under test directly with focused fakes or
real test dependencies.

## Environment

Required server environment variables:

```txt
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
```

Optional:

```txt
PORT
NODE_ENV
CORS_ORIGINS
S3_BUCKET
S3_REGION
S3_ENDPOINT
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_PRESIGNED_UPLOAD_EXPIRES_SECONDS
S3_PRESIGNED_READ_EXPIRES_SECONDS
MAX_DIRECT_UPLOAD_BYTES
IMAGE_PIPELINE_CALLBACK_SECRET
TEST_DATABASE_URL
```

`TEST_DATABASE_URL` is test-only. It must refer to a disposable database and
is required by `bun run test:integration`; regular server commands continue to
use `DATABASE_URL`.

`CORS_ORIGINS` is also passed to Better Auth as its trusted-origin list. Keep
`BETTER_AUTH_URL` aligned with the URL where `/api/auth/*` is served.

Use `server/.env.example` as the local template.

## Public Backend Docs

The backend serves:

```txt
GET /openapi.json
GET /docs
```

`/docs` renders Scalar from the OpenAPI document.

## Request Flow

```txt
Request
  -> CORS
  -> Security headers
  -> Request ID
  -> Request logger
  -> Better Auth routes or API routes
  -> Zod validation
  -> Controller
  -> Service
  -> Drizzle/Postgres
  -> JSON response
```

## Required Local Checks

Run the full package-local suite before considering backend changes complete:

```sh
bun run lint
bun run typecheck
bun run format
bun run test
```

Run database integration tests separately when a disposable database is
available:

```sh
TEST_DATABASE_URL=postgresql://... bun run test:integration
```

CI runs the same commands for the client, server, and image pipeline. See the
[Development Workflow](../development-workflow.md) for the pre-commit hook and
cross-package commands.

## Related Docs

- [Collection Canvas Architecture](../collection-canvas.md)
- [Color Image Search](../color-image-search.md)
- [Controller Pattern](./controller-pattern.md)
- [Service Method Pattern](./service-method-pattern.md)
- [Assets Schema](./assets-schema.md)
- [Schema Design Rationale](./schema-design-rationale.md)
- [Image Upload and Processing Pipeline](./image-upload-implementation-plan.md)
- [Image Pipeline Reliability and Evolution](./image-pipeline-reliability.md)
- [Error Handling](./error-handling.md)
- [Scaffold Recipes](./scaffold-recipes.md)
