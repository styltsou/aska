# Image Delivery Architecture

Image originals and generated renditions are private S3 objects delivered
through a dedicated CloudFront distribution. The delivery hostname is
`images.styltsou.com` in the stable `dev` stage.

```text
Canvas query
  -> API returns https://images.styltsou.com/{workspaceId}/{storageId}/display.webp
  -> browser sends CloudFront signed cookies
  -> CloudFront validates the cookies and checks its cache
      -> cache hit: return rendition
      -> cache miss: read private S3 object through Origin Access Control
```

## Object contract

The database stores object keys, never delivery URLs. A unique storage ID makes
each media representation immutable:

```text
{workspaceId}/{storageId}/original.{extension}
{workspaceId}/{storageId}/display.webp
{workspaceId}/{storageId}/preview.webp
```

`workspaceId` is the immutable organization ID, not a mutable workspace slug.
Putting it first is deliberate: the storage namespace is the same tenant
boundary used for authorization, so a member's CloudFront policy can grant
exactly `/{workspaceId}/*`. `storageId` is a unique immutable upload ID, and
the sibling files are representations of the same asset with the same access
boundary. Together, those choices give every rendition a permanent URL that is
safe to cache indefinitely.

The S3 key is not a folder or collection path. Folders and collections are
database placement only. Moving an asset between them must not rename S3
objects; that would invalidate cached URLs and turn a metadata change into a
multi-object storage operation. A future cross-workspace transfer must instead
copy or re-key all representations into the destination workspace namespace.

Every key is immutable, so browser uploads and worker-generated files use:

```text
Cache-Control: public, max-age=31536000, immutable
Content-Type: source type for original.*; image/webp for variants
```

Do not overwrite an existing rendition key. An edit or regeneration must write
a new versioned key and update the stored metadata. This keeps browser and CDN
caches correct without invalidations.

## Distribution and authorization

`sst.config.ts` creates the `images` distribution, an S3 Origin Access Control
(OAC), a CloudFront public key and trusted key group, plus a cache policy that
excludes cookies, headers, and query strings from the cache key. The bucket is
not public and CloudFront can read private workspace media through OAC.

Before an image-backed workspace route renders, the client calls the dedicated
authenticated `POST /api/v1/media/session/{workspaceSlug}` endpoint. It
verifies workspace membership and issues a CloudFront custom-policy cookie for
only `https://images.styltsou.com/{workspaceId}/*`. CloudFront custom policies
have one resource scope, so the application mints one policy per authorized
workspace rather than a broad media-wide policy. Cookies are short-lived,
HTTP-only, `Secure`, `SameSite=None`, and use the parent domain with a
`/{workspaceId}/` path. The parent domain is necessary because the API and CDN
are sibling subdomains; the narrow path lets one browser hold separate
same-named cookies for multiple open workspaces without cross-workspace media
access. The client deduplicates issuance per workspace and refreshes the active
session shortly before expiry. CloudFront validates the cookies before serving
an object; they do not fragment cache entries. Logout clears every current
workspace cookie through `DELETE /api/v1/media/session` before revoking the
Better Auth session.

`SameSite=None` keeps the deployed application working as a normal same-site
flow while allowing the supported `dev:cloud` localhost client to send media
cookies to the CDN. Browsers that block all third-party cookies still need the
same-site HTTPS tunnel workflow for local browser testing.

The image worker receives media object-created events. Because the workspace ID
is the top-level key segment, there is no single static source prefix that
matches originals for every workspace. Events are therefore forwarded and the
worker strictly accepts only `original.*` keys, ignoring `display.webp` and
`preview.webp` writes so generated output cannot recursively trigger processing.

The media distribution is a delivery boundary, not an application
authorization substitute. API endpoints continue to enforce user and
organization access before returning asset metadata.

## Read paths

- Original, display, and preview files use stable CloudFront URLs in the
  deployed media stage.
- Browser uploads use presigned S3 **PUT** URLs in their workspace namespace.
- Local and hybrid development also use uncached, short-lived presigned S3 GET
  URLs because they have separate storage resources.

Presigned GET URLs are created on demand. The application does not retain them
in a Lambda or browser cache. A CloudFront delivery failure must surface in the
stable `dev` environment instead of being hidden by a fallback cache.

## Signing-key operations

`CloudFrontMediaPrivateKeyBase64` is an SST secret, set directly for each
stage before the first deployment. SST derives and registers the matching
public key from that private key, so a mismatched key pair cannot be deployed.
The API receives the private key and signs viewer cookies. Rotate the SST
secret, then merge a deployment-triggering change to `main`; GitHub Actions
does not store or copy this runtime key.
