# System Architecture

This is the map of the implemented Aska system. Read it before making a
cross-cutting change. Product direction is described in the root
[README](../README.md); a capability mentioned there is not necessarily built
yet. This document describes the code and AWS resources that exist today.

## Purpose and implemented surface

Aska is a multi-tenant visual workspace. A workspace owns collections, assets,
and members. The Inbox is an archive rendered as a masonry board. A collection
is an authored infinite canvas that can contain image assets, note assets, and
folders. Folders are canvas nodes that open nested canvases; they are not
assets.

The implemented system includes Better Auth sessions and organizations,
workspace/collection navigation, image ingestion, notes, folders, canvas
placement and moves, palette extraction, and local color search. Social-link
capture, article ingestion, saved smart collections, and full-text retrieval
are product direction, not current services. Do not add UI or API behavior by
assuming those planned features already have a data model.

## Runtime topology

```text
React/Vite client (CloudFront-backed static site in a deployment)
  ├─ cookie-authenticated JSON API requests ───────────────┐
  └─ presigned PUT of original image ──> private S3 bucket │
                                                        API Gateway
                                                            │
                                                    Hono API Lambda
                                                     ├─ Better Auth
                                                     ├─ Drizzle ──> Neon/Postgres
                                                     └─ stable CloudFront URLs for original and rendition reads

S3 original.* object-created event
  ├─ SQS -> image-variants Lambda -> S3 workspace image variants -> signed API callback
  └─ SQS -> image-palette Lambda -------------> signed API callback
```

`sst.config.ts` is the infrastructure source of truth. SST creates the API,
private asset bucket, event notifications, queues, DLQs, worker Lambdas,
and static client site. One SST stage is a complete isolated AWS environment.
The shared `dev` stage is a stable cloud deployment that only accepts its
deployed CloudFront client at `aska-app.styltsou.com`; its API is
`aska-api.styltsou.com`. `hybrid` is the personal stage for Live-Lambda
hybrid work. The planned HTTPS tunnel variant for browser/image-upload work is
documented in [Cloudflare Tunnel Hybrid Development](./cloudflare-tunnel-hybrid-development.md).
Deployment details, stage policy, and secret handling are in
[AWS workflow](./sst-deployment.md).

## Repository map

| Path                       | Owns                                          | Start here when changing it                                      |
| -------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `client/`                  | React 19/Vite browser application             | `src/routes/`, `src/api/`, `src/components/`, `src/store/`       |
| `server/`                  | Hono API Lambda, auth, persistence, OpenAPI   | `src/app.ts`, `src/routes/`, `src/controllers/`, `src/services/` |
| `services/image-shared/`   | SQS retry contract and signed callback client | `src/sqs-handler.ts`, `src/pipeline-callback.ts`                 |
| `services/image-variants/` | Sharp rendition worker                        | `src/lambda.ts`, `src/processor.ts`                              |
| `services/image-palette/`  | Sharp/OKLab palette worker                    | `src/lambda.ts`, `src/processor.ts`                              |
| `sst.config.ts`            | AWS topology and runtime environment          | resource definitions and Lambda environments                     |
| `docs/`                    | Durable architecture and contribution context | [Documentation home](./README.md)                                |

Each package has its own `package.json`, lockfile, TypeScript config, and
quality commands. Install and run commands from the package being changed.

## Client architecture

TanStack Router owns URL-to-screen mapping. `src/routes/` contains route
components and route-local data loading. `src/api/` owns typed server-state
fetchers, React Query hooks, query keys, and optimistic cache transitions.
`src/components/` owns presentational and interaction components; canvas code
is deliberately isolated under `components/canvas/`, while Inbox/masonry code
lives under `components/board/`.

React Query is the source of truth for API data. Zustand is only for browser
interaction state that is not server state: selection, transient board state,
and persisted UI preferences such as filters and viewport state. Do not put a
server response into Zustand just to make it easier to access.

The API client in `client/src/lib/api.ts` sends cookie-authenticated requests
to `VITE_SERVER_URL` and unwraps the server's `{ data }` envelope. New API
features should add a feature-local module under `src/api/<feature>/` rather
than placing requests directly in a component.

## API architecture

The API is intentionally layered but lightweight:

```text
route -> validation/auth middleware -> controller -> service -> Drizzle/Postgres
```

- Routes compose endpoints and apply middleware.
- DTOs are Zod schemas; infer request types from those schemas.
- Controllers are HTTP adapters only.
- Services own authorization checks, domain rules, transactions, queries, and
  response projections. Cohesive service helpers live beside their feature.
- `container.ts` is the explicit composition root for shared dependencies.
- `app.ts` owns cross-cutting HTTP behavior: CORS, security headers, request
  IDs, tracing, request logging, errors, auth routes, and API mounting.

Read [Server Guide](./server/index.md), [Controller Pattern](./server/controller-pattern.md),
and [Service Method Pattern](./server/service-method-pattern.md) before adding
an endpoint. Every public API change must update `server/src/openapi.json`.

## Data and ownership model

Postgres/Drizzle is authoritative for application state. S3 is authoritative
for immutable image bytes. The API stores workspace-rooted media object keys
and builds stable CloudFront URLs for original and rendition reads; it never
stores delivery URLs.

`assets` is the common record for archived content. `image_assets` and
`note_assets` are concrete subtype tables. `folders` are separate organizational
containers. `collection_nodes` describes a collection's spatial tree and owns
a placement's parent folder, canvas coordinates, and denormalized folder path.
`uploads` is a durable asynchronous image-workflow record, not an asset.

Tenant identifiers are deliberately repeated on some tables and protected by
composite foreign keys. Preserve that constraint model whenever adding a
tenant-scoped relation. The detailed reasons and query implications are in
[Assets Schema](./server/assets-schema.md) and
[Schema Design Rationale](./server/schema-design-rationale.md).

## Image ingestion lifecycle

```text
create upload session + image asset + upload record (transaction)
  -> browser PUTs original to {workspaceId}/{storageId}/original.{extension}
  -> S3 fan-out to independent SQS workers
  -> variants worker writes display/preview files and callbacks API
  -> palette worker writes search colors and callbacks API
  -> client polls upload status while processing
```

The two workers are independent and at-least-once. Callbacks must be HMAC
verified, idempotent, and guarded by the original object key plus ETag. New
asynchronous image work should get its own queue/worker unless it has the same
retry and failure semantics as an existing worker. See
[Image Upload and Processing Pipeline](./server/image-upload-implementation-plan.md)
and [Image Pipeline Reliability](./server/image-pipeline-reliability.md).
Current image-delivery behavior is documented in
[Image Delivery Architecture](./image-delivery-architecture.md).

## Observability and operations

The API emits one structured JSON record for a completed request, with
`request_id`, Sentry trace IDs, route template, status, duration, and severity.
It does not log bodies, query strings, raw paths, headers, or secrets. Tracing
and error monitoring use Sentry across the browser, API, and image workers;
CloudWatch retains the same structured server and worker logs as a fallback.

Read [Observability](./server/observability.md) before adding logs or changing
deployment telemetry. Important domain outcomes and external failures deserve
structured service logs; normal method entry/exit logs do not.

## Safe change boundaries

- Preserve the API envelope and OpenAPI contract together.
- Preserve workspace/organization scoping in every query and mutation.
- Keep browser upload bytes out of the API Lambda; use presigned S3 URLs.
- Never let generated variants trigger image work; workers accept only
  `{workspaceId}/{storageId}/original.*` events.
- Keep worker callbacks authenticated on their raw payload and idempotent.
- Treat React Query as server state and keep optimistic transitions scoped to
  the cache keys they affect.
- Add a doc update whenever an architectural contract, workflow, deployment
  assumption, or contributor convention changes.
