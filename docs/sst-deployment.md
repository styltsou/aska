# Aska AWS workflow

SST defines and deploys the application in [`sst.config.ts`](../sst.config.ts).
One stage creates one isolated AWS copy:

```text
stage dev
  API Gateway -> Hono Lambda
  private S3 assets bucket -> SNS -> two SQS queues -> variants and palette Lambdas
  API -> URL-resolution SQS -> resolver Lambda -> image-variants SQS -> shared renderer -> S3
  EventBridge Scheduler -> media-cleanup Lambda -> cleanup + stale resource-work recovery
  private S3 client bucket -> CloudFront -> React/Vite client
  dead-letter queue, IAM permissions, and stage-specific SST secrets
```

## Stage and mode policy

SST has two distinct operating modes that must not share a stage:

- **`dev` is the stable shared cloud environment.** GitHub Actions deploys
  real Lambda code there after a passing push to `main`. The deployed
  CloudFront client always points at this stable API.
- **`hybrid` is the personal hybrid stage for SST Live forwarding only.**
  `SST_STAGE=hybrid bun run dev:aws` creates a separate API, bucket, queues,
  and Lambdas whose function invocations are forwarded to that terminal.
- **A future public-production stage is intentionally not configured yet.** Add
  its real domain, secrets, and explicit origin only when it exists; SST fails
  closed for unrecognised stages. Never run `sst dev` against a stable stage.

This separation is required because `sst dev` replaces a stage's deployed
Lambda code with forwarding stubs. If that terminal stops, the stubs have no
local process to execute and respond with `sst dev is not running`. The
recovery for a stage accidentally used with Live mode is to restore the code
and trigger the GitHub Actions deployment workflow.

SST stage names are resource namespaces, not labels. Before the first `hybrid`
run, set the four `hybrid` stage secrets listed below.

## What runs where

| Mode                               | Code runs                      | AWS services                            | Use it for                                  |
| ---------------------------------- | ------------------------------ | --------------------------------------- | ------------------------------------------- |
| `SST_STAGE=hybrid bun run dev:aws` | Lambda handlers on your laptop | Real `hybrid` S3, SQS, API Gateway, IAM | Fast backend iteration with Live forwarding |
| GitHub Actions deployment          | Lambdas + Vite client in AWS   | Real `dev` resources + CloudFront       | Fully cloud-based testing                   |
| Direct package commands            | Your laptop                    | No AWS event chain                      | Unit tests and isolated debugging only      |

Both SST modes are real end-to-end AWS flows. With live development, an image
uploaded from the browser goes to the real S3 bucket, publishes one SNS event,
and SNS creates one message in each image-processing queue for the variants and
palette workers. In the stable CI deployment, those same workers run in AWS.
Both test the actual permissions, event shape, queue flow, and callback path.
Pasting a URL additionally exercises the resolution queue and sends discovered
media commands to the shared variants queue. Signed claims, safe external
retrieval, and private S3 variant delivery remain independent progressive steps.

## One-time stable `dev` setup

### 1. AWS login

No AWS credentials belong in this repository. SST uses the temporary session
from the default AWS CLI login already configured on your machine:

```sh
aws login
```

Run it again when the temporary session expires.

The `deploy`, `dev:aws`, and `sst` scripts automatically translate the CLI's
`aws login` session into the standard temporary AWS environment credentials SST
expects. Do not run `aws configure` or create long-lived access keys for this.

`hybrid` does not initialise Cloudflare and therefore does **not** require
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_DEFAULT_ACCOUNT_ID`, or
`CLOUDFLARE_ZONE_ID`. Those values are required only when deploying the stable
`dev` stage with its Cloudflare-managed custom domains.

For an arbitrary SST subcommand, use `bun run sst --`, for example:

```sh
bun run sst -- diff --stage dev
```

### 2. Cloudflare domain and Access setup

The stable `dev` deployment uses exactly these public hostnames:

```text
aska-app.styltsou.com  -> Cloudflare (proxied) -> CloudFront client
aska-api.styltsou.com  -> Cloudflare (proxied) -> API Gateway HTTP API
images.styltsou.com    -> Cloudflare DNS-only -> private CloudFront media
```

### 3. CloudFront media signing keys

The stable media distribution requires an RSA-2048 key pair. Generate the
private key locally, derive its public key, and store **both** base64-encoded
values as SST secrets for the `dev` stage. Keep the unencoded private PEM out
of the repository:

```sh
openssl genrsa -out cloudfront-media-private.pem 2048
openssl base64 -A -in cloudfront-media-private.pem
openssl rsa -in cloudfront-media-private.pem -pubout | openssl base64 -A
```

The second command's output is `CloudFrontMediaPrivateKeyBase64`; the third is
`CloudFrontMediaPublicKey`. Set both before the first deployment. SST then
creates the CloudFront trusted key group, origin access control, and
`images.styltsou.com` distribution. The API receives the private key secret and
issues HTTP-only signed cookies for one authorized workspace path through the
dedicated media-session endpoint. Media keys begin with the immutable workspace
ID (`{workspaceId}/{storageId}/...`), so each cookie policy can grant only that
workspace's `/{workspaceId}/*` path while originals and generated variants
retain stable canonical URLs. Rotate by updating **both** SST secrets, then
merging a deployment-triggering change.

Before the first CI deployment, create a Cloudflare API token scoped only to
the `styltsou.com` zone with **Zone / DNS / Edit** and **Zone / Zone / Read**.
Add the token, account ID, and zone ID as GitHub Actions repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_DEFAULT_ACCOUNT_ID
CLOUDFLARE_ZONE_ID
```

SST uses that token to create the DNS records and validate the AWS-managed ACM
certificates. Do not hand-create the application CNAME records: SST owns them.
The app and API DNS records are proxied through Cloudflare because Cloudflare
Access only enforces policy for proxied hostnames. `images` is deliberately
DNS-only so CloudFront remains the sole media edge and validates its signed
cookies. Set the Cloudflare zone SSL/TLS mode to **Full (strict)**.

Before the first deploy, create one Cloudflare Zero Trust **self-hosted Access
application** containing both application domains above. Add an **Allow**
policy for the approved email addresses, and enable Cloudflare's one-time-pin
identity provider if there is no external identity provider. Everyone not
matching an Allow policy is denied. Keeping both domains on the same Access
application lets browser navigation and credentialed API requests use the same
Access session.

In that application's **Advanced settings → CORS settings**, enable
**Bypass OPTIONS requests to origin**. Do not configure Access-managed CORS
response headers for this application.

Browsers never send cookies on an `OPTIONS` preflight, so Access cannot
authenticate that request. This narrowly bypasses Access only for the
preflight; API Gateway and Hono then enforce the exact CORS policy, and every
real API request still requires a valid Cloudflare Access JWT. The deployment
config sets the permitted browser origin to `https://aska-app.styltsou.com`.

Create more-specific self-hosted Access path rules for these pipeline callbacks:

```text
https://aska-api.styltsou.com/api/v1/internal/image-pipeline/callback
https://aska-api.styltsou.com/api/v1/internal/url-resolution/claim
https://aska-api.styltsou.com/api/v1/internal/url-resolution/result
https://aska-api.styltsou.com/api/v1/internal/resource-media/claim
https://aska-api.styltsou.com/api/v1/internal/resource-media/result
```

Use exact-path applications, or one application matching only
`/api/v1/internal/*`, with a **Bypass / Everyone** policy. Cloudflare's
more-specific rule takes precedence over the API-wide Allow rule. The origin
itself exempts only the five explicit paths above, and every handler requires a
rotated HMAC callback secret plus timestamp/replay checks. Do not broaden the
bypass beyond `/api/v1/internal/*` or use Bypass on the API hostname itself.
Any future internal endpoint must add HMAC authentication before it is included
in both allowlists.

The API's generated `execute-api` hostname is disabled in this stage. This is
important: otherwise it would be an unprotected route around the Access policy.
The API also verifies Cloudflare's signed Access JWT on every request at the
origin. Add the Access application's **team domain** (including `https://`)
and **AUD tag** as these GitHub Actions repository secrets:

```text
CLOUDFLARE_ACCESS_TEAM_DOMAIN
CLOUDFLARE_ACCESS_AUD
```

This prevents a request that somehow reaches AWS without passing through
Cloudflare from being treated as an authenticated browser request. The only
origin-level exemptions are the explicit HMAC-authenticated pipeline paths
described above, plus CORS preflight.

If Cloudflare Access is not configured yet, do that first and do not share the
hostnames until it is in place.

### 4. Stage secrets

Set these once. SST encrypts and stores them in AWS for the `dev` stage; they
are not local environment files and are never committed to Git.

```sh
bun run sst -- secret set DatabaseUrl 'your Neon connection URL' --stage dev
bun run sst -- secret set BetterAuthSecret 'your existing Better Auth secret' --stage dev
bun run sst -- secret set ResendApiKey 'your Resend API key' --stage dev
bun run sst -- secret set PexelsApiKey 'your Pexels API key' --stage dev
bun run sst -- secret set ImagePipelineCallbackSecret 'a random 32+ character secret' --stage dev
bun run sst -- secret set CloudFrontMediaPrivateKeyBase64 'base64-encoded RSA-2048 private key' --stage dev
bun run sst -- secret set CloudFrontMediaPublicKey 'SPKI PEM public key matching the private key' --stage dev
bun run sst -- secret set SentryDsn 'https://public-key@o0.ingest.sentry.io/project-id' --stage dev
```

### What each value configures

| SST secret                        | Where SST injects it                                            | Why it exists                                                            |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DatabaseUrl`                     | `DATABASE_URL` in the API                                       | Connects the API to Neon                                                 |
| `BetterAuthSecret`                | `BETTER_AUTH_SECRET` in the API                                 | Signs/encrypts Better Auth data                                          |
| `ResendApiKey`                    | `RESEND_API_KEY` in the API                                     | Sends transactional email                                                |
| `PexelsApiKey`                    | `PEXELS_API_KEY` in the API                                     | Enables server-side Pexels search and imports                            |
| `ImagePipelineCallbackSecret`     | Image/resource pipeline HMAC environment in the API and workers | Pipelines sign callbacks; the API verifies them                          |
| `CloudFrontMediaPrivateKeyBase64` | `CLOUDFRONT_PRIVATE_KEY_BASE64` in the API                      | Signs CloudFront viewer cookies                                          |
| `CloudFrontMediaPublicKey`        | CloudFront `PublicKey` resource                                 | Verifies signed cookies at the edge; generated once with the private key |
| `SentryDsn`                       | Sentry DSN in the client, API, and workers                      | Routes application telemetry to the Sentry project                       |

There is one pipeline callback secret at the SST layer. It is injected as
`PIPELINE_CALLBACK_SECRET` in the API and every worker. Signing transport is
shared while upload, URL-resolution, and resource-media claim/result schemas
remain separate domain contracts.

The API and maintenance Lambda read queue URLs from SST's linked `Resource`
object. Do not also inject those URLs as custom environment variables: links
already grant send permissions and provide the typed URL at runtime, while
duplicating them consumes the Lambda's fixed 4 KB environment block. The
`URL_RESOLUTION_QUEUE_URL` and `IMAGE_VARIANTS_QUEUE_URL` settings remain
optional fallbacks only for a server started directly outside SST.

### Personal Live-stage secrets

SST secrets are stage-scoped. Before starting a personal Live stage for the
first time, set the same required secret names for that stage:

```sh
bun run sst -- secret set DatabaseUrl 'a disposable development database URL' --stage hybrid
bun run sst -- secret set BetterAuthSecret 'a distinct random 32+ character secret' --stage hybrid
bun run sst -- secret set ResendApiKey 'your development Resend key' --stage hybrid
bun run sst -- secret set ImagePipelineCallbackSecret 'a distinct random 32+ character secret' --stage hybrid
bun run sst -- secret set SentryDsn 'your Sentry project DSN' --stage hybrid
```

Do not copy production credentials into a Live stage. A personal stage creates
its own bucket and queues, but the database URL is chosen by you; use a
disposable database if you need data isolation from the shared `dev` stage.

## React/Vite client: CloudFront + custom domain

SST's `Client` StaticSite builds `client/` with Bun, stores only the resulting
`dist/` files in a private S3 bucket, and serves them through CloudFront. The
build receives `VITE_SERVER_URL` automatically from the API Gateway URL; there
is no client production `.env` file to create or maintain.

The GitHub Actions deployment deploys **both** the backend and this client.
The client is served as `https://aska-app.styltsou.com` and is built with
`https://aska-api.styltsou.com` as `VITE_SERVER_URL`. CloudFront remains the
client's origin and its S3 bucket remains private; Cloudflare is the public
edge and Access gate.

The image Lambda packages the Linux `sharp` runtime from the pipeline's Bun
installation. SST does not run npm to assemble that Lambda package.

## Client origin, CORS, and Better Auth

The client origin is ordinary deployment configuration, not a secret. It is
defined once in `sst.config.ts`:

```ts
const clientOrigins = {
  hybrid: ["http://localhost:5173"],
  dev: ["https://aska-app.styltsou.com", "http://localhost:5173"],
};
```

`hybrid` accepts local Vite and nothing else. `dev` accepts its deployed client
domain plus the exact local Vite origin, so client work can use the fully
deployed API, S3 bucket, and queues. Do not use a broad wildcard: allow the
exact domain you control.

That one value configures all three required allow-lists:

1. API Gateway CORS, so the browser can call the API.
2. S3 CORS, so the browser can upload directly with a presigned URL.
3. Both Hono's `CORS_ORIGINS` and Better Auth's `trustedOrigins`, so cookies and
   Better Auth's origin/CSRF checks allow the client.

`BETTER_AUTH_TRUSTED_ORIGINS` is intentionally not an environment variable.
It was redundant: Better Auth uses the same `CORS_ORIGINS` list as the API.
`BETTER_AUTH_URL` is different—it is the API's own URL and SST sets it from the
API Gateway URL automatically.

### Authentication domain note

The stable client and API share the `styltsou.com` parent domain. Browser
requests to `aska-api.styltsou.com` are therefore same-site, which avoids the
third-party-cookie behavior that breaks cross-domain authentication in Safari.
The stable stage shares Better Auth cookies only across the `styltsou.com`
parent domain and limits their path to `/api/`, keeping them off static app and
media requests. To support local Vite against the cloud API, that stage uses
`Secure`, `SameSite=None`, and `Partitioned` session cookies; the `hybrid`
stage retains its existing cookie configuration. CORS and Better Auth continue
to allow only the exact origins above. Safari can still block its third-party
cookies, so use the HTTPS tunnel described in
[Cloudflare Tunnel hybrid development](./cloudflare-tunnel-hybrid-development.md)
when Safari-compatible authentication is required.

For client-only work against the deployed backend, leave the normal local
configuration pointed at your `hybrid` API and start Vite in cloud mode instead:

```sh
cd client
bun run dev:cloud
```

This changes only Vite's API target for that process; it does not start, stop,
or modify the `hybrid` SST stage.

## Daily development: real end-to-end AWS flow

1. From the repository root, start the hybrid client and personal Live stage
   together. The command stops both when you press Ctrl-C:

   ```sh
   bun run dev
   ```

   The first run provisions the personal resources. It uses the hybrid API URL
   in `client/.env.local`. The underlying `dev:aws` script refuses `dev` or an
   omitted stage so a shared deployed client cannot accidentally be turned into
   a forwarding target.

2. Upload an image in the browser. It follows this real path:

   ```text
   browser -> API -> S3 {workspaceId}/{storageId}/original.* -> SNS -> variants SQS + palette SQS
           -> local worker callbacks -> API
   ```

When you stop `sst dev`, only your personal stage's Lambda proxies lose their
local handler. Its resources can remain until you no longer need that stage.
If you ever accidentally run Live mode on a stable stage, restore normally
deployed Lambda code by triggering the GitHub Actions deployment workflow.

For routine browser/auth/image-upload development, prefer the tunnel-based
personal setup once it is enabled. It gives Vite a stable HTTPS client domain
and avoids treating the API as a cross-site third party.

## Fully cloud-based `dev` testing

Use this when you want the browser, API, and image pipeline all off your
laptop:

1. Merge the change to `main` and wait for the `Deploy AWS dev` GitHub Actions
   job to succeed.
2. Open `https://aska-app.styltsou.com`. SST embedded the custom API URL into
   the Vite build, so no client environment variable is needed.

The shared `dev` API intentionally rejects local Vite requests. Use
`https://aska-app.styltsou.com` for fully deployed testing, or use `hybrid`
for hybrid development.

## Continuous deployment

GitHub Actions runs the client, server, image-pipeline, and URL-resource worker quality checks for
pull requests and pushes to `main`. After the checks pass for a push to `main`,
the workflow deploys real Lambda code to the stable SST `dev` stage.

### Path-based job filtering

The workflow gates both the quality jobs and the deployment on which files
actually changed (`dorny/paths-filter` in a `changes` job). Only the affected
parts run, so a client-only change does not rebuild the server or the image
workers:

| Change                          | Quality jobs run                            | Deploys `dev` |
| ------------------------------- | ------------------------------------------- | ------------- |
| `client/**`                     | Client                                      | Yes           |
| `server/**`                     | Server                                      | Yes           |
| `services/image-variants/**`    | Image variants                              | Yes           |
| `services/image-palette/**`     | Image palette                               | Yes           |
| `services/image-shared/**`      | Server, variants, palette, and URL resolver | Yes           |
| `services/url-unfurl-shared/**` | Server, URL resolver, and image variants    | Yes           |
| `services/url-resolution/**`    | URL resolver                                | Yes           |
| SST config / root deps / CI     | Server (plus jobs matching other paths)     | Yes           |
| Docs / Markdown only            | None                                        | No            |

`services/image-shared` and `services/url-unfurl-shared` are dependencies, not
deployment targets. Their changes re-run every package that follows their
source imports. A change to the SST config, the root
`package.json`/`bun.lock`, or `.github/workflows/**`
forces the Server job (and the deployment), since those are the closest signal
that the wired-up stack still compiles. `sst.config.ts` changes always deploy
because SST reconciles the whole stack in one run.

**When you add a new worker service**, register its directory in two places in
`.github/workflows/ci.yml`: add a filter entry (and a matching `image-shared`
dependency if it consumes the shared package) and add its path to the `deploy`
filter. Forgetting either silently disables that service's checks or its
deployment.

The deployment job exchanges a GitHub OIDC token for short-lived AWS

The deployment job exchanges a GitHub OIDC token for short-lived AWS
credentials and does not use AWS access keys. Runtime secrets, including the
CloudFront private key and Sentry DSN, are stage-scoped SST secrets set
separately from CI. The AWS role trusts only the
`styltsou/aska` repository's `main` branch.

The job also requires these GitHub Actions repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_DEFAULT_ACCOUNT_ID
CLOUDFLARE_ZONE_ID
CLOUDFLARE_ACCESS_TEAM_DOMAIN
CLOUDFLARE_ACCESS_AUD
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
```

The Sentry auth token is build-only and uploads browser source maps. The
workflow sets `SENTRY_RELEASE` from the deployed Git commit so the client, API,
workers, and uploaded artifacts share one release identifier.

The token has the same narrowly scoped permissions listed in the Cloudflare
setup section. It is used only by the deploy step to reconcile application and
media DNS records plus certificate validation records.

Use the GitHub Actions run as the deployment record. Do not add a production
deployment trigger until the production stage, custom domain, and separate
secrets/database are configured. Never use that CI-owned `dev` stage for
`sst dev`.

## Public production later

When the client has a public domain and you are ready to launch:

1. Add an explicit stage config with that environment's real custom app/API
   domains and Cloudflare DNS configuration.
2. Create its own SST secrets and use a separate database URL—not the `dev`
   database.
3. Create a matching Cloudflare Access application before deployment.
4. Deploy through the production CI workflow. SST embeds the custom production
   API URL in the Vite build automatically.

There is intentionally no staging environment yet. Add one only when you need
a production-like rehearsal environment.

## Local-only commands

`server/.env` is retained for direct server runs, Drizzle commands, and tests.
The pipeline fixture is retained for narrow, fast handler debugging. Neither
can exercise browser uploads through S3 and SQS end-to-end, so neither is the
main development workflow.

For local Live development, use `SST_STAGE=hybrid bun run dev:aws`. Never run
SST Live or a manual deployment against the CI-owned `dev` stage. Keep a small
AWS Budget and a CloudWatch billing alarm enabled.
