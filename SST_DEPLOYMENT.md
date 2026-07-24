# Aska AWS workflow

SST defines and deploys the application in [`sst.config.ts`](sst.config.ts).
One stage creates one isolated AWS copy:

```text
stage dev
  API Gateway -> Hono Lambda
  private S3 assets bucket -> SNS -> two SQS queues -> variants and palette Lambdas
  private S3 client bucket -> CloudFront -> React/Vite client
  dead-letter queue, IAM permissions, and stage-specific SST secrets
```

## Stage and mode policy

SST has two distinct operating modes that must not share a stage:

- **`dev` is the stable shared cloud environment.** CI and `bun run deploy
  --stage dev` deploy real Lambda code there. The deployed CloudFront client
  always points at this stable API.
- **`styltsoy` is the personal hybrid stage for SST Live forwarding only.**
  `SST_STAGE=styltsoy bun run dev:aws` creates a separate API, bucket, queues,
  and Lambdas whose function invocations are forwarded to that terminal.
- **A future public-production stage is intentionally not configured yet.** Add
  its real domain, secrets, and explicit origin only when it exists; SST fails
  closed for unrecognised stages. Never run `sst dev` against a stable stage.

This separation is required because `sst dev` replaces a stage's deployed
Lambda code with forwarding stubs. If that terminal stops, the stubs have no
local process to execute and respond with `sst dev is not running`. The
recovery for a stage accidentally used with Live mode is simply to deploy real
code again: `bun run deploy --stage <stage>`.

## What runs where

| Mode                          | Code runs                      | AWS services                         | Use it for                                               |
| ----------------------------- | ------------------------------ | ------------------------------------ | -------------------------------------------------------- |
| `SST_STAGE=styltsoy bun run dev:aws` | Lambda handlers on your laptop | Real `styltsoy` S3, SQS, API Gateway, IAM | Fast backend iteration with Live forwarding |
| `bun run deploy --stage dev`  | Lambdas + Vite client in AWS   | Real `dev` resources + CloudFront    | Fully cloud-based testing; preferred when laptop is slow |
| Direct package commands       | Your laptop                    | No AWS event chain                   | Unit tests and isolated debugging only                   |

Both SST modes are real end-to-end AWS flows. With live development, an image
uploaded from the browser goes to the real S3 bucket, publishes one SNS event,
and SNS creates one message in each image-processing queue for the variants and
palette workers. With a normal deploy, those same workers run in AWS instead.
Both test the actual permissions, event shape, queue flow, and callback path.

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
For an arbitrary SST subcommand, use `bun sst`, for example:

```sh
bun sst diff --stage dev
```

### 2. Cloudflare domain and Access setup

The stable `dev` deployment uses exactly these public hostnames:

```text
app.aska.styltsou.com  -> Cloudflare (proxied) -> CloudFront client
api.aska.styltsou.com  -> Cloudflare (proxied) -> API Gateway HTTP API
```

Before deploying, create a Cloudflare API token scoped only to the
`styltsou.com` zone with **Zone / DNS / Edit** and **Zone / Zone / Read**. Find
the Cloudflare zone ID in that zone's overview page, then expose both values
only to the shell running SST:

```sh
export CLOUDFLARE_API_TOKEN='...'
export CLOUDFLARE_DEFAULT_ACCOUNT_ID='...'
export CLOUDFLARE_ZONE_ID='...'
```

SST uses that token to create the DNS records and validate the AWS-managed ACM
certificates. Do not hand-create the application CNAME records: SST owns them.
The DNS records are proxied through Cloudflare because Cloudflare Access only
enforces policy for proxied hostnames. Set the Cloudflare zone SSL/TLS mode to
**Full (strict)**.

Before the first deploy, create one Cloudflare Zero Trust **self-hosted Access
application** containing both application domains above. Add an **Allow**
policy for the approved email addresses, and enable Cloudflare's one-time-pin
identity provider if there is no external identity provider. Everyone not
matching an Allow policy is denied. Keeping both domains on the same Access
application lets browser navigation and credentialed API requests use the same
Access session.

In that application's **Advanced settings → CORS settings**, configure
Cloudflare to answer preflight requests with the same policy as the origin:

```text
Access-Control-Allow-Origin: https://app.aska.styltsou.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

Browsers never send cookies on an `OPTIONS` preflight, so without this Access
configuration Cloudflare would reject preflight before API Gateway or Hono can
return their CORS headers.

Create one additional, more-specific self-hosted Access application for this
exact callback URL:

```text
https://api.aska.styltsou.com/api/v1/internal/image-pipeline/callback
```

Give that path-only application a **Bypass / Everyone** policy. Cloudflare's
more-specific path rule takes precedence over the API-wide Allow rule. This is
not a user bypass: it is the only route the asynchronous AWS image workers can
reach without a browser Access cookie, and the API independently requires its
rotated HMAC callback secret, timestamp/replay checks, and upload-key
validation. Do not broaden the path, add a wildcard, or use Bypass on the API
hostname itself.

The API's generated `execute-api` hostname is disabled in this stage. This is
important: otherwise it would be an unprotected route around the Access policy.
The API also verifies Cloudflare's signed Access JWT on every request at the
origin. Copy the Access application's **team domain** (including `https://`)
and its **AUD tag** into the deployment environment:

```sh
export CLOUDFLARE_ACCESS_TEAM_DOMAIN='https://your-team.cloudflareaccess.com'
export CLOUDFLARE_ACCESS_AUD='the-access-application-aud-tag'
```

This prevents a request that somehow reaches AWS without passing through
Cloudflare from being treated as an authenticated browser request. The only
origin-level exemption is the exact HMAC-authenticated image callback path
described above, plus CORS preflight.

If Cloudflare Access is not configured yet, do that first and do not share the
hostnames until it is in place.

### 3. Stage secrets

Set these once. SST encrypts and stores them in AWS for the `dev` stage; they
are not local environment files and are never committed to Git.

```sh
bun sst secret set DatabaseUrl 'your Neon connection URL' --stage dev
bun sst secret set BetterAuthSecret 'your existing Better Auth secret' --stage dev
bun sst secret set ResendApiKey 'your Resend API key' --stage dev
bun sst secret set ImagePipelineCallbackSecret 'a random 32+ character secret' --stage dev
```

### What each value configures

| SST secret                    | Where SST injects it                             | Why it exists                                        |
| ----------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `DatabaseUrl`                 | `DATABASE_URL` in the API                        | Connects the API to Neon                             |
| `BetterAuthSecret`            | `BETTER_AUTH_SECRET` in the API                  | Signs/encrypts Better Auth data                      |
| `ResendApiKey`                | `RESEND_API_KEY` in the API                      | Sends transactional email                            |
| `ImagePipelineCallbackSecret` | `IMAGE_PIPELINE_CALLBACK_SECRET` in both Lambdas | The pipeline signs its callback; the API verifies it |

There is only one image-pipeline callback secret. The same SST secret is passed
to both functions under the same `IMAGE_PIPELINE_CALLBACK_SECRET` name. Do not
create a separate pipeline-only callback secret.

### Personal Live-stage secrets

SST secrets are stage-scoped. Before starting a personal Live stage for the
first time, set the same required secret names for that stage:

```sh
bun sst secret set DatabaseUrl 'a disposable development database URL' --stage styltsoy
bun sst secret set BetterAuthSecret 'a distinct random 32+ character secret' --stage styltsoy
bun sst secret set ResendApiKey 'your development Resend key' --stage styltsoy
bun sst secret set ImagePipelineCallbackSecret 'a distinct random 32+ character secret' --stage styltsoy
```

Do not copy production credentials into a Live stage. A personal stage creates
its own bucket and queues, but the database URL is chosen by you; use a
disposable database if you need data isolation from the shared `dev` stage.

## React/Vite client: CloudFront + custom domain

SST's `Client` StaticSite builds `client/` with Bun, stores only the resulting
`dist/` files in a private S3 bucket, and serves them through CloudFront. The
build receives `VITE_SERVER_URL` automatically from the API Gateway URL; there
is no client production `.env` file to create or maintain.

`bun run deploy --stage dev` deploys **both** the backend and this client. The
client is served as `https://app.aska.styltsou.com` and is built with
`https://api.aska.styltsou.com` as `VITE_SERVER_URL`. CloudFront remains the
client's origin and its S3 bucket remains private; Cloudflare is the public
edge and Access gate.

The image Lambda packages the Linux `sharp` runtime from the pipeline's Bun
installation. SST does not run npm to assemble that Lambda package.

## Client origin, CORS, and Better Auth

The client origin is ordinary deployment configuration, not a secret. It is
defined once in `sst.config.ts`:

```ts
const clientOrigins = {
  styltsoy: ["http://localhost:5173"],
  dev: ["https://app.aska.styltsou.com"],
};
```

`styltsoy` accepts local Vite and nothing else. `dev` accepts only its deployed
custom client domain. The deployed client can call the real `dev` API, upload
to the `dev` S3 bucket, and use the `dev` SQS pipeline. Local Vite intentionally
cannot call that API; use `styltsoy` for hybrid development. Do not use a broad
wildcard: allow the exact domain you control.

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

The stable client and API share the `aska.styltsou.com` parent domain. Browser
requests to `api.aska.styltsou.com` are therefore same-site, which avoids the
third-party-cookie behavior that breaks cross-domain authentication in Safari.
Better Auth keeps host-only secure cookies and its default `SameSite=Lax`
policy; do not broaden cookie scope to `styltsou.com` or relax CSRF/origin
checks. The planned HTTPS version of personal development is documented in
[Cloudflare Tunnel hybrid development](docs/cloudflare-tunnel-hybrid-development.md).

## Daily development: real end-to-end AWS flow

1. Start SST in a **personal** stage and leave it running. The `dev:aws`
   script refuses `dev` or an omitted stage so a shared deployed client cannot
   accidentally be turned into a forwarding target:

   ```sh
   SST_STAGE=styltsoy bun run dev:aws
   ```

   The first run provisions the personal resources. SST prints that stage's API
   URL.

2. In a second terminal, start the client pointed at that URL:

   ```sh
   cd client
   VITE_SERVER_URL=https://your-personal-api-url.execute-api.eu-central-1.amazonaws.com bun run dev
   ```

3. Upload an image in the browser. It follows this real path:

   ```text
   browser -> API -> S3 ingest/ -> SNS -> variants SQS + palette SQS
           -> local worker callbacks -> API
   ```

When you stop `sst dev`, only your personal stage's Lambda proxies lose their
local handler. Its resources can remain until you no longer need that stage.
If you ever accidentally run Live mode on a stable stage, restore normally
deployed Lambda code with:

```sh
bun run deploy --stage dev
```

For routine browser/auth/image-upload development, prefer the tunnel-based
personal setup once it is enabled. It gives Vite a stable HTTPS client domain
and avoids treating the API as a cross-site third party.

## Fully cloud-based `dev` testing

Use this when you want the browser, API, and image pipeline all off your
laptop:

1. Set the two Cloudflare deployment environment variables described above.
2. Run `bun run deploy --stage dev`.
3. Open `https://app.aska.styltsou.com`. SST embedded the custom API URL into
   the Vite build, so no client environment variable is needed.

The shared `dev` API intentionally rejects local Vite requests. Use
`https://app.aska.styltsou.com` for fully deployed testing, or use `styltsoy`
for hybrid development.

## Continuous deployment

GitHub Actions runs the full client, server, and image-pipeline quality checks
for pull requests and pushes to `main`. After the checks pass for a push to
`main`, the workflow deploys real Lambda code to the stable SST `dev` stage.

The deployment job exchanges a GitHub OIDC token for short-lived AWS
credentials. It does not use AWS access keys or copy SST secrets into GitHub.
The AWS role trusts only the `styltsou/aska` repository's `main` branch.

The job also requires these GitHub Actions repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_DEFAULT_ACCOUNT_ID
CLOUDFLARE_ZONE_ID
CLOUDFLARE_ACCESS_TEAM_DOMAIN
CLOUDFLARE_ACCESS_AUD
```

The token has the same narrowly scoped permissions listed in the Cloudflare
setup section. It is used only by the deploy step to reconcile the two DNS
records and certificate validation records.

Manual deployment remains available when needed:

```sh
bun run deploy --stage dev
```

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
4. Deploy. SST embeds the custom production API URL in the Vite build
   automatically.

There is intentionally no staging environment yet. Add one only when you need
a production-like rehearsal environment.

## Local-only commands

`server/.env` is retained for direct server runs, Drizzle commands, and tests.
The pipeline fixture is retained for narrow, fast handler debugging. Neither
can exercise browser uploads through S3 and SQS end-to-end, so neither is the
main development workflow.

## Reference commands

```sh
bun sst diff --stage dev
export CLOUDFLARE_API_TOKEN='...'
export CLOUDFLARE_DEFAULT_ACCOUNT_ID='...'
export CLOUDFLARE_ZONE_ID='...'
export CLOUDFLARE_ACCESS_TEAM_DOMAIN='https://your-team.cloudflareaccess.com'
export CLOUDFLARE_ACCESS_AUD='the-access-application-aud-tag'
bun run deploy --stage dev
SST_STAGE=styltsoy bun run dev:aws
bun sst secret list --stage dev
bun sst remove --stage dev
```

Use `remove` only for an environment you intend to delete. Keep a small AWS
Budget and a CloudWatch billing alarm enabled.
