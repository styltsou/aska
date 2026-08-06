# Cloudflare Tunnel hybrid development

This is the intended next step for browser-facing work in the personal
`hybrid` stage, especially image-upload UI work. It is deliberately separate
from the stable `dev` environment.

```text
aska-hybrid-app.styltsou.com  -> Cloudflare Tunnel -> local Vite :5173
aska-hybrid-api.styltsou.com  -> API Gateway -> personal hybrid Lambda/API
```

Both hostnames are under `styltsou.com`, so browsers treat them as same-site.
This keeps Better Auth cookies and credentialed API calls reliable
without allowing `localhost` to call the shared `dev` API. It also gives image
uploads a real HTTPS client origin for S3 CORS and presigned PUT testing.

## What this is for

- Editing frontend upload, progress, retry, and error-state behavior against
  the real personal S3/SNS/SQS image pipeline.
- Testing browser authentication, CORS, and cookies in the same HTTPS shape as
  cloud deployment.
- Sharing a narrowly protected personal preview with a collaborator when
  needed.

It is not a replacement for the stable cloud `dev` stage, and `sst dev` must
never target `dev`.

## Deferred setup checklist

When this environment is needed, make these stage-specific changes together:

1. Add `aska-hybrid-app.styltsou.com` as a Cloudflare Tunnel public hostname
   that forwards to `http://localhost:5173`. Run Vite normally on the laptop.
2. Give the `hybrid` API an API Gateway custom domain named
   `aska-hybrid-api.styltsou.com`, backed by the same Cloudflare zone. Its
   API origin, API Gateway CORS, S3 CORS, Hono CORS, and Better Auth trusted
   origins must all allow only `https://aska-hybrid-app.styltsou.com`.
3. Build local Vite with
   `VITE_SERVER_URL=https://aska-hybrid-api.styltsou.com`; do not use a raw
   `execute-api` URL for browser authentication work.
4. Put both hostnames in the same Cloudflare Access application or matching
   Access policy. Restrict it to the approved email identities and use the
   one-time-pin login method if no identity provider is configured. If the API
   is Access-protected, add the same exact-path Bypass described in the AWS
   workflow for its HMAC-authenticated image-worker callback—never bypass the
   whole API.
5. Keep the tunnel credential outside the repository and stop the tunnel when
   the laptop should no longer expose the preview.

The names intentionally use one label below `styltsou.com`, which Cloudflare
Universal SSL covers without an Advanced Certificate Manager add-on.

## Operational rule

Use `SST_STAGE=hybrid bun run dev:aws` only for Live forwarding. It changes
the personal stage's Lambda invocations into forwarding stubs, so its browser
client and tunnel must be treated as unavailable when that terminal is stopped.
The stable `dev` app and API remain fully deployed and do not depend on this
laptop.
