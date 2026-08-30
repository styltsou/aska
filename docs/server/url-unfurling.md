# URL Unfurling and External Resources

This document describes the implemented generic HTTP(S) URL-unfurling system.
It is the source of truth for link-card persistence, resolution, media handling,
security, caching, retries, and future resolver extensions.

## Responsibility boundaries

The feature extends Aska's existing asset and collection-node architecture. It
does not introduce a second card system.

| Concept            | Owner                                       | Responsibility                                                                              |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Card               | `assets`, `link_assets`, `collection_nodes` | Workspace ownership, original pasted URL, placement, and board lifecycle                    |
| Resource           | `external_resources`                        | Workspace-scoped normalized external thing and current resolved fields                      |
| Resolution attempt | `resource_resolution_attempts`              | Durable trigger, generation, lease, retry, status, and safe diagnostics                     |
| Resource media     | `external_resource_media`                   | Discovered source, semantic role, processing policy, stored variants, and independent state |
| Resolver           | `services/url-resolution/`                  | Identify and normalize what a URL represents; request downstream media work                 |
| Media variants     | `services/image-variants/`                  | Safely acquire upload or resource-media sources and generate role/profile-specific variants |
| Optional ingestion | future service/table                        | Document extraction, chunks, embeddings, and indexing; not part of this release             |

`server/src/services/url-unfurl/url-unfurl.service.ts` coordinates persistence
and state transitions. `server/src/services/url-unfurl/projection.ts` is the
only place that projects resources and stored media into `CollectionLinkNode`.
Provider-specific fields stay in `external_resources.provider_extensions` and
must not leak into the generic card contract.

## Optimistic paste-to-ready flow

```mermaid
sequenceDiagram
  participant U as User
  participant C as React client
  participant A as Hono API
  participant D as Postgres
  participant Q as Resolution SQS
  participant R as URL resolver Lambda
  participant M as Image variants SQS/Lambda
  participant S as Private S3

  U->>C: Paste or drop HTTP(S) URL
  C->>C: Insert local hostname card
  C->>A: POST collection/inbox link
  A->>D: Transaction: asset + link + resource/attempt
  A-->>C: 201 persisted usable link card
  A->>Q: Enqueue attempt ID + generation
  C->>A: Poll collection while queued/resolving
  Q->>R: Deliver attempt
  R->>A: Signed claim(ID, generation)
  A-->>R: Normalized URL or ignored
  R->>R: SSRF-safe fetch and bounded metadata parse
  R->>A: Signed metadata result + media intents
  A->>D: Guard generation; persist metadata/media rows
  A->>M: Enqueue media IDs + generations
  A-->>C: Collection read exposes text metadata
  M->>A: Signed media claim(ID, generation)
  A-->>M: Remote media URL, role, and profile
  M->>M: SSRF-safe fetch, validate, transform
  M->>S: Store immutable WebP variants
  M->>A: Signed variant manifest
  A->>D: Guard generation; mark media/resource ready
  A-->>C: Collection read exposes authorized stored media
  C->>C: Stop polling at ready, partial, or failed
```

The create response does not wait for either queue. A queue-send failure marks
the attempt failed but leaves the link asset readable and clickable.

## Client creation and rendering

`client/src/lib/clipboard.ts` accepts a single HTTP(S) URL from clipboard text
and standard browser drag data (`text/uri-list`, then `text/plain`). Image-file
drops retain precedence. `use-board-asset-actions.ts` sends URLs through the
link endpoint; explicit Pexels and remote-image imports keep using the primary
image pipeline.

`client/src/api/url-unfurl/hooks.ts` inserts a local `CollectionLinkNode` into
the appropriate React Query cache, reserves its canvas position, and reconciles
the temporary ID with the persisted node. Collection and Inbox queries poll at
1.5 seconds only while at least one visible link is `queued` or `resolving`.
They stop for terminal `ready`, `partial`, and `failed` states.

`client/src/components/board/cards/link-asset-card.tsx` always renders a usable
anchor from the user-supplied URL. It progressively adds text, favicon, and
preview imagery. Remote discovered images are never rendered directly; the API
only projects signed or stable URLs for validated objects in Aska storage.
There are no user title or description overrides in this release.

## URL identity, reuse, and freshness

`server/src/services/url-unfurl/url-normalization.ts` owns URL identity:

- only `http:` and `https:` are accepted;
- surrounding whitespace and fragments are removed;
- URL parsing provides standard hostname/default-port normalization;
- query parameters, their order, and their values are retained because they
  can change resource identity;
- a SHA-256 hash of the full normalized URL is the indexed cache key;
- a unique `(organization_id, normalized_url_hash)` constraint scopes reuse to
  one workspace and prevents cross-tenant metadata or media disclosure.

Canonical URLs are validated resolver output and presentation metadata. They
never replace the normalized identity or the original URL on the card.

Successful results are fresh for `URL_UNFURL_SUCCESS_TTL_SECONDS` (seven days
by default). Failures use `URL_UNFURL_FAILURE_TTL_SECONDS` (15 minutes by
default), so transient errors are not permanently cached. Pasting a fresh URL
reuses the resource; pasting a stale resource creates a new generation while
the existing metadata remains renderable. Manual refresh uses the same
generation path. Broad scheduled refresh is deliberately excluded.

## Resolution and provenance

`services/url-resolution/src/types.ts` defines an ordered resolver registry.
Specialized resolvers will be registered before the generic resolver. A
resolver can return a partial enrichment and set `continueAfterResolve`; later
matching resolvers fill missing fields. Exceptions also fall through, allowing
generic resolution after provider failure, rate limiting, or unsupported
content. Earlier values and media roles win; generic resolution fills only
fields and roles the specialized resolver did not provide.

The generic resolver in `generic-resolver.ts` retrieves at most 1 MiB of HTML
without executing JavaScript. `html-metadata.ts` applies per-field precedence:

1. Open Graph;
2. Twitter Card;
3. standard HTML title/description/link metadata;
4. URL path and hostname fallbacks.

Each persisted field records its resolver and metadata source in
`field_provenance`. The resource records resolver key/version and a resolution
generation. Those fields allow later resolver-version invalidation and explain
which source supplied a value.

## Media roles and image processing

Resolvers declare media intent rather than processing bytes. Each
`external_resource_media` row has an explicit role and versioned processing
profile:

- `preview` + `link-preview-v1`: visual summary only; stored master, display,
  preview, and blur placeholder; no palette or embeddings;
- `icon` + `icon-v1`: at most 64 by 64, stored as a validated WebP master;
- `primary` and `cover`: reserved extension roles. A future resolver must map
  them to an explicit profile before use.

The image-variants worker owns a common profile-driven Sharp processor with two
source adapters: trusted S3 upload events and generation-guarded resource-media
commands. The latter claims its untrusted remote URL through the API, retrieves
it with the SSRF-safe client, and feeds the same processor. Processing caps
input at 20 MiB and 40 megapixels, rejects multi-page/animated input, never
enlarges the source, and writes immutable keys under
`{organizationId}/{storageId}/`. Preview and icon profiles do not invoke the
palette pipeline or treat an Open Graph image as principal content.

Completed variant manifests store object keys, dimensions, content type, and
size. `ObjectStorageService` applies the existing workspace-private delivery
policy at projection time. Replaced or orphaned objects are removed through
the existing `media_cleanup_jobs` outbox rather than inline S3 deletion.

## Retrieval security and privacy

All external HTML and media retrieval uses
`services/url-unfurl-shared/src/safe-fetch.ts`:

- credential-free HTTP(S) URLs only;
- DNS resolution rejects private, loopback, link-local, multicast, reserved,
  carrier-grade NAT, and other non-public ranges;
- every resolved address must be public, and the validated address is pinned
  into the request lookup to mitigate DNS rebinding;
- redirects are resolved and revalidated one at a time, with a limit of five;
- connection/request and total deadlines are enforced;
- `Accept-Encoding: identity` avoids compressed-body expansion attacks;
- declared and streamed byte limits are both enforced;
- allowlisted content types are required before parsing;
- response bodies, headers, query strings, credentials, and discovered URLs
  are not written to application logs.

Metadata strings are bounded by the callback Zod contract and rendered through
React text nodes. HTML is never persisted or injected into the DOM. Canonical,
favicon, and preview URLs are resolved against the final fetched URL, limited
to HTTP(S), stripped of fragments, and treated only as untrusted retrieval
inputs.

URLs containing credentials or query keys that clearly indicate credentials,
tokens, secrets, passwords, API keys, or signatures are persisted as basic
link cards but are not fetched. Manual refresh cannot override that boundary.
This conservative key-based check does not remove arbitrary query parameters.

Workspace attempt creation is limited to 60 per rolling hour. Queue concurrency,
response limits, SQS redrive policies, and workspace-scoped reuse provide
additional abuse and cost containment. Future provider resolvers must also
honor provider API terms, authentication scope, robots/copyright policy, and
rate limits; the generic HTML fetch does not grant permission to ingest or
republish full content.

## State, retries, and races

The card-facing state is intentionally compact:

| State       | Meaning                                                  | UI behavior                                           |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------- |
| `queued`    | Durable attempt exists or is being enqueued              | Hostname card and subtle progress                     |
| `resolving` | Metadata and/or required media work is active            | Show every field already available                    |
| `partial`   | Useful metadata exists but preview processing failed     | Keep text/basic card; retry is available              |
| `ready`     | Metadata is complete and required media work is terminal | Full available card                                   |
| `failed`    | Metadata resolution failed or retrieval was blocked      | Basic clickable original URL; retry only when allowed |

Resolution attempts and media jobs are at-least-once. SQS messages contain only
database IDs and generations. Before doing remote work, a worker makes an
HMAC-authenticated claim through `resource-pipeline.controller.ts`; the API
verifies that the row is current, referenced, and claimable. Results use the
same signed raw-body contract.

Generation checks make callbacks idempotent and reject out-of-order results.
The 150-second processing lease expires before the queue's 180-second
visibility timeout, so a retry can reclaim the same task and preserve its SQS
receive count. The scheduled maintenance Lambda requeues work still stale after
five minutes, identifies resources with no remaining link assets, and deletes
resources after a seven-day grace period. Deleting the last card while work runs
makes future claims no-ops; cascades remove rows and cleanup jobs remove stored
objects.
Multiple cards for one URL share the resource and media while retaining their
own original URL and placement.

## API and authorization

Public endpoints are documented in `server/src/openapi.json`:

- `POST /api/v1/workspace/:workspaceSlug/collections/:collectionSlug/links`;
- `POST /api/v1/workspace/:workspaceSlug/inbox/links`;
- `POST /api/v1/workspace/:workspaceSlug/links/:assetId/resolution`.

They use the existing Better Auth workspace lookup and organization boundary.
No client-provided organization or resource ID is trusted. Internal claim and
result endpoints live under `/api/v1/internal/` and require an HMAC SHA-256
signature made with `PIPELINE_CALLBACK_SECRET`; they do not use a
browser session and are not part of the public OpenAPI document.

## Observability

The API logs only resource, attempt, media, generation, outcome, and duration
identifiers. The shared task handler reuses the image workers' Sentry helpers
for per-message spans, duration distributions, exception capture, receive
counts, and callback failures. CloudWatch queue age, errors, throttles, and DLQ
depth remain the infrastructure fallback.

Useful operational dimensions are resolver key/version, processing profile,
failure category, HTTP status class, attempt trigger, and terminal outcome.
Never add normalized URLs, source URLs, query strings, metadata bodies, or
provider extensions to logs or metrics.

## Tests and local verification

Tests use local values, in-memory HTML, generated image buffers, and address
fixtures; they never call live websites. Coverage is split by ownership:

- server normalization tests cover schemes, fragments, query identity, and
  sensitive-query blocking;
- shared safe-fetch tests cover public/private/reserved address policy;
- resolver tests cover precedence, fallbacks, malformed metadata, composition,
  and specialized failure fallback;
- media tests cover validation, role profiles, and no-upscale behavior;
- client tests cover clipboard/drop URL detection and conditional polling;
- database integration tests cover optimistic persistence, duplicate-resource
  reuse, progressive/partial results, stale generations, sensitive URLs, and
  deletion during active resolution;
- existing server/client suites protect collection, movement, rendering, and
  backward-compatible image/note behavior.

Run checks in every changed package. Database integration tests additionally
require a disposable `TEST_DATABASE_URL`.

## Adding a specialized resolver

1. Implement `UrlResolver` in `services/url-resolution/` with a narrow
   `matches(URL)` predicate, stable key, and explicit version.
2. Register it before `GenericHtmlResolver`; avoid a central hostname switch.
3. Return normalized resource fields, provenance, provider extensions, and
   role/profile media intents. Do not download or transform assets there.
4. Set `continueAfterResolve` when generic metadata should fill missing fields.
5. Convert unsupported, unauthorized, rate-limited, and provider failures into
   fallback behavior; never make the generic card unusable.
6. Add local fixtures for selection, composition, fallback, and policy cases.

Document and implement a new processing profile before emitting a new media
intent. Document extraction and indexing should consume a future ingestion
intent into their own durable artifacts and jobs; they must not expand the
resource row into an unbounded mutable preview object.
