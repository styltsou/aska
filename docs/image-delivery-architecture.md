# Image Delivery Architecture

Generated image renditions are private S3 objects delivered through a dedicated
CloudFront distribution. The delivery hostname is `images.styltsou.com` in the
stable `dev` stage.

```text
Canvas query
  -> API returns https://images.styltsou.com/assets/{storageId}/display.webp
  -> browser sends CloudFront signed cookies
  -> CloudFront validates the cookies and checks its cache
      -> cache hit: return rendition
      -> cache miss: read private S3 object through Origin Access Control
```

## Object contract

The database stores object keys, never delivery URLs. A unique storage ID makes
each generated rendition immutable:

```text
ingest/{storageId}/original.{extension}
assets/{storageId}/display.webp
assets/{storageId}/preview.webp
```

The variants worker writes generated files with:

```text
Cache-Control: public, max-age=31536000, immutable
Content-Type: image/webp
```

Do not overwrite an existing rendition key. An edit or regeneration must write
a new versioned key and update the stored metadata. This keeps browser and CDN
caches correct without invalidations.

## Distribution and authorization

`sst.config.ts` creates the `images` distribution, an S3 Origin Access Control
(OAC), a CloudFront public key and trusted key group, plus a cache policy that
excludes cookies, headers, and query strings from the cache key. The bucket is
not public and CloudFront can read only the `assets/` prefix.

Authenticated API responses set short-lived, HTTP-only CloudFront cookies for
the parent domain. Their policy permits `https://images.styltsou.com/assets/*`.
CloudFront validates the cookies before it serves an object; the cookies do not
fragment cache entries.

The media distribution is a delivery boundary, not an application
authorization substitute. API endpoints continue to enforce user and
organization access before returning asset metadata.

## Read paths

- Generated display and preview renditions use stable CloudFront URLs.
- Browser uploads use presigned S3 **PUT** URLs to `ingest/`.
- Original-file reads use short-lived presigned S3 **GET** URLs when a feature
  explicitly needs them. `ingest/` is not served by the media distribution.
- Local and hybrid development also use uncached, short-lived presigned S3 GET
  URLs because they have separate storage resources.

Presigned GET URLs are created on demand. The application does not retain them
in a Lambda or browser cache. A CloudFront delivery failure must surface in the
stable `dev` environment instead of being hidden by a fallback cache.

## Signing-key operations

The CI deployment workflow reads these GitHub Actions repository secrets and
writes them to the stage-scoped SST secrets before deployment:

```text
CLOUDFRONT_MEDIA_PUBLIC_KEY_BASE64
CLOUDFRONT_MEDIA_PRIVATE_KEY_BASE64
```

The public key is registered in CloudFront; the API receives the private key
and signs viewer cookies. Rotate both values together, then merge a change to
`main` so CI deploys the replacement.
