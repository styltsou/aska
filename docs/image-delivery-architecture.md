# Image Delivery Architecture

This document separates the image-processing pipeline from image _delivery_.
The pipeline creates private S3 objects. Delivery determines how a browser is
allowed to read and cache those objects.

## Status

- **Implemented today:** private S3 objects delivered with short-lived S3
  presigned GET URLs.
- **Planned upgrade:** a dedicated CloudFront media distribution in front of
  the same private S3 bucket, using stable media URLs and viewer authorization.

The static client site already uses CloudFront through SST's `StaticSite`.
That is separate from the planned media distribution described here.

## Current design: private S3 with presigned reads

```text
Canvas query
  -> API Lambda reads image variant object keys from Postgres
  -> API Lambda signs each required S3 GET request
  -> API response contains signed display/preview/original URLs
  -> browser requests image bytes directly from private S3
```

The browser still uploads originals directly to S3 with a presigned **PUT**
URL. That upload design remains correct after the delivery upgrade; only image
reads change.

### Object identity

The API stores object keys, not public or expiring URLs. The variants worker
creates a unique storage ID per upload and writes deterministic rendition keys:

```text
ingest/{storageId}/original.{extension}
assets/{storageId}/display.webp
assets/{storageId}/preview.webp
```

The canvas normally receives `display.webp`. The API uses the stored object
keys to create read URLs just before it sends a collection response.

### Presigned URL lifetime and server cache

`S3_PRESIGNED_READ_EXPIRES_SECONDS` defaults to 900 seconds (15 minutes) and
is constrained to 60–3600 seconds. A presigned URL is a bearer credential:
anyone who obtains it can read that one object until it expires, even if their
application session is later removed.

`ObjectStorageService` keeps an in-memory LRU cache of up to 500 signed read
URLs, keyed by object key and requested lifetime. On the same warm API Lambda,
it returns the cached URL until fewer than 30 seconds remain. It then signs a
replacement.

This cache is deliberately local to one Lambda runtime. It is not Redis,
DynamoDB, or a cross-instance cache. Another warm instance or a cold start can
sign a different URL for the same object while the original remains valid.
That is normal Lambda behavior, not a data-integrity problem.

## Why a refetch used to flash blur placeholders

A signed URL contains its signature and issuance time in the query string. Two
valid signatures for the same `assets/{storageId}/display.webp` path are still
different browser resource URLs:

```text
.../display.webp?X-Amz-Signature=old
.../display.webp?X-Amz-Signature=new
```

React Query correctly refetches collection data after relevant mutations. If
that refetch reaches another API Lambda, the response can replace every image
`src` with a newly signed URL. The browser then treats each URL as a new cache
key and `ProgressiveImage` previously showed its blur placeholder while the
replacement decoded.

This was a delivery-URL churn issue; it was not caused by the canvas layout or
by React Query itself.

## Current client mitigation

`client/src/lib/presigned-image-url.ts` keeps a bounded, tab-local cache of up
to 500 presigned URLs. It identifies the same S3 object by origin and path,
intentionally ignoring the signing query string.

- If a cached URL has more than one minute remaining, the client keeps using
  it when an API refetch supplies a new signature for the same object.
- Near expiry, it adopts the newly supplied URL.
- `ProgressiveImage` keeps the last decoded image painted until a replacement
  has decoded, so the expiry transition does not regress to a blur thumbnail.

This is a pragmatic compatibility layer for presigned URLs. It is bounded,
works across API Lambda instances, and has no new infrastructure. It does not
turn S3 into a CDN, create a shared backend cache, or make URLs stable across
browser sessions.

Redis or DynamoDB is intentionally not used here. Sharing short-lived URL
strings would add a service, cost, and failure mode without improving image
byte delivery. The client mitigation can be removed once normal canvas reads
use stable CloudFront URLs.

## Target design: private S3 behind CloudFront

```text
Canvas query
  -> API returns stable media URL: https://images.example.com/assets/{storageId}/display.webp
  -> browser requests CloudFront
  -> CloudFront authorizes viewer and checks its edge cache
      -> cache hit: serve image from edge
      -> cache miss: read from private S3 through Origin Access Control
```

The image pipeline stays the same:

```text
browser presigned PUT -> private S3 ingest/
  -> SNS -> variants worker -> private S3 assets/
```

CloudFront changes only the read path for completed media.

### Required components

1. A separate `images.<domain>` CloudFront distribution with the asset bucket
   as its origin.
2. S3 Origin Access Control (OAC), so the bucket remains private and only
   CloudFront can read media objects. Do not make the bucket public.
3. A cache behavior for the media path, normally `/assets/*`.
4. A custom cache policy that does not fragment the cache by auth material.
5. Viewer authorization, preferably CloudFront signed cookies for the canvas.
6. Long browser/CDN cache headers on immutable rendition objects.

The `ingest/` prefix is not a general media endpoint. Keep it private unless
the product explicitly needs to display originals, in which case give that
read path a separate, deliberate authorization and caching policy.

### Why signed cookies are the default for the canvas

Canvas pages can render many images at once. With CloudFront signed cookies,
the image URL is stable and authorization travels in the browser's cookie:

```text
https://images.example.com/assets/{storageId}/display.webp
```

CloudFront validates the viewer's signed cookie before serving the object. The
cookie is not part of the normal image cache key, so one authorized request can
populate an edge cache entry used by other authorized viewers. The API still
decides when to issue or renew the viewer authorization.

CloudFront signed URLs remain useful for a one-off download or share link.
They are less attractive for a dense authenticated canvas because their query
strings reintroduce URL churn unless the CloudFront cache policy is designed
very carefully.

Use a CloudFront trusted key group for signing. Do not use the legacy root
account key-pair mechanism.

### Cache semantics and object keys

Once CloudFront serves a rendition with a long immutable cache lifetime, its
object path must identify its bytes permanently. A unique upload `storageId`
already makes each asset distinct. If a future edit, crop, or regeneration can
overwrite `display.webp` for an existing asset, it must instead create a new
versioned object key (for example `display-v2.webp`) and update the database.
The alternative is a targeted CloudFront invalidation, which is slower and
more operationally expensive.

The variants worker should set explicit headers for immutable generated files,
for example:

```text
Cache-Control: public, max-age=31536000, immutable
Content-Type: image/webp
```

Apply this only to versioned/immutable rendition keys. Do not blindly give
long cache headers to mutable objects.

### Authorization boundary

CloudFront does not replace application authorization. The API still verifies
the user, organization, and asset access before it issues a signed-cookie
policy. The media distribution then enforces that short-lived viewer grant at
the edge.

Design the custom domains and cookie scope before implementing this. A common
shape is `app.example.com`, `api.example.com`, and `images.example.com`, with
the authorization cookie scoped safely to the parent domain only if that is
appropriate for the product's security model.

## Migration plan

1. Add the media subdomain, CloudFront distribution, OAC, TLS certificate, and
   restrictive bucket policy in SST. Leave the existing presigned GET path in
   place initially.
2. Define the viewer authorization policy and key rotation/renewal behavior.
   Use signed cookies for normal canvas viewing.
3. Make generated rendition keys explicitly immutable and set their cache
   headers. Version keys before introducing image editing/regeneration.
4. Add a media URL builder in the API. Collection responses should return the
   stable CloudFront media URL for completed variants instead of an S3
   presigned GET URL.
5. Release behind a feature flag or a short dual-read period. Verify cache-hit
   rate, 403s, image error rate, and tenant-access behavior.
6. Remove the browser presigned-URL stabilization code once the canvas no
   longer receives changing S3 read URLs. Keep presigned PUT uploads.

## Decisions for now

- Keep S3 presigned read URLs at the current 15-minute default.
- Keep the server's local URL cache and the client stabilization layer.
- Do not add Redis or DynamoDB for presigned URL sharing.
- Do not expose the S3 bucket publicly.
- Plan CloudFront as a media-delivery upgrade, not as a change to the
  S3 -> SNS -> SQS processing pipeline.
