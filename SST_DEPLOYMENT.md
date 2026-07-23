# Aska AWS workflow

SST defines and deploys the application in [`sst.config.ts`](sst.config.ts).
One stage creates one isolated AWS copy:

```text
stage dev
  API Gateway -> Hono Lambda
  private S3 assets bucket -> SQS -> image-processing Lambda
  private S3 client bucket -> CloudFront -> React/Vite client
  dead-letter queue, IAM permissions, and stage-specific SST secrets
```

Use **only `dev` for now**. It is a real cloud development environment, not a
mock and not production. A future `production` stage will be a second, separate
copy for the public client. Do not create personal stages yet: each one creates
another API, bucket, queues, and Lambdas.

## What runs where

| Mode                          | Code runs                      | AWS services                         | Use it for                                               |
| ----------------------------- | ------------------------------ | ------------------------------------ | -------------------------------------------------------- |
| `bun run dev:aws --stage dev` | Lambda handlers on your laptop | Real `dev` S3, SQS, API Gateway, IAM | Fast backend iteration against real AWS                  |
| `bun run deploy --stage dev`  | Lambdas + Vite client in AWS   | Real `dev` resources + CloudFront    | Fully cloud-based testing; preferred when laptop is slow |
| Direct package commands       | Your laptop                    | No AWS event chain                   | Unit tests and isolated debugging only                   |

Both SST modes are real end-to-end AWS flows. With live development, an image
uploaded from the browser goes to the real S3 bucket, creates a real SQS
message, and invokes the image pipeline running locally. With a normal deploy,
the same pipeline runs in AWS instead. Both test the actual permissions, event
shape, queue flow, and callback path.

## One-time `dev` setup

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

### 2. Stage secrets

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

## React/Vite client: S3 + CloudFront

SST's `Client` StaticSite builds `client/` with Bun, stores only the resulting
`dist/` files in a private S3 bucket, and serves them through CloudFront. The
build receives `VITE_SERVER_URL` automatically from the API Gateway URL; there
is no client production `.env` file to create or maintain.

`bun run deploy --stage dev` deploys **both** the backend and this client. SST
prints a `client` URL such as `https://d123example.cloudfront.net`. CloudFront
is the public website; its S3 bucket is not public.

The image Lambda packages the Linux `sharp` runtime from the pipeline's Bun
installation. SST does not run npm to assemble that Lambda package.

### First deploy without a custom domain

The generated CloudFront hostname is not known until AWS creates it. For that
reason, the very first cloud-client setup has one safe bootstrap step:

1. Deploy `dev` once and copy the printed `client` URL.
2. Add that exact URL to `clientOrigins.dev` in `sst.config.ts`.
3. Deploy `dev` once more.

The second deploy allows that generated website through API Gateway CORS, S3
CORS, Hono, and Better Auth. We intentionally do not use a broad CloudFront or
HTTPS wildcard just to avoid this one-time step: it would let arbitrary sites
make credentialed browser requests to the API.

When you later use a custom domain such as `app.example.com`, put that known
domain in the matching stage's `clientOrigins` before deploying. No bootstrap
step is needed.

## Client origin, CORS, and Better Auth

The client origin is ordinary deployment configuration, not a secret. It is
defined once in `sst.config.ts`:

```ts
const clientOrigins = {
  dev: ["http://localhost:5173"],
  production: ["https://replace-with-your-client-domain.example"],
};
```

The `dev` list can deliberately contain both your local Vite origin and the
generated AWS CloudFront development-client origin. After the first deploy,
add the exact URL SST printed:

```ts
dev: [
  "http://localhost:5173",
  "https://d123example.cloudfront.net",
],
```

Then redeploy `dev`. Both the deployed client and local Vite client can call
the same real `dev` API, upload to the same `dev` S3 bucket, and use the same
SQS pipeline. Do not use a broad wildcard: allow the exact domain you control.

When deploying the public client, replace the `production` placeholder with its
real origin, for example `https://app.example.com`, then deploy production.
That one value automatically configures all three required allow-lists:

1. API Gateway CORS, so the browser can call the API.
2. S3 CORS, so the browser can upload directly with a presigned URL.
3. Both Hono's `CORS_ORIGINS` and Better Auth's `trustedOrigins`, so cookies and
   Better Auth's origin/CSRF checks allow the client.

`BETTER_AUTH_TRUSTED_ORIGINS` is intentionally not an environment variable.
It was redundant: Better Auth uses the same `CORS_ORIGINS` list as the API.
`BETTER_AUTH_URL` is different—it is the API's own URL and SST sets it from the
API Gateway URL automatically.

### Authentication domain note

For fast development, a CloudFront domain calling the AWS API URL is fine for
API and image-flow testing. However, Better Auth uses browser cookies. For
reliable login sessions across all browsers—especially Safari—use custom client
and API domains under the same parent domain later, such as
`app.example.com` and `api.example.com`, or proxy API requests through the
client domain. Do not weaken Better Auth's origin or CSRF checks to work around
this.

## Daily development: real end-to-end AWS flow

1. Start SST and leave it running:

   ```sh
   bun run dev:aws --stage dev
   ```

   The first run provisions the `dev` resources. SST prints the `dev` API URL.

2. In a second terminal, start the client pointed at that URL:

   ```sh
   cd client
   VITE_SERVER_URL=https://your-api-url.execute-api.eu-central-1.amazonaws.com bun run dev
   ```

3. Upload an image in the browser. It follows this real path:

   ```text
   browser -> API -> S3 ingest/ -> SQS -> local image Lambda -> API callback
   ```

When you stop `sst dev`, its AWS Lambda proxies can no longer reach your
laptop. Restore normally deployed Lambda code with:

```sh
bun run deploy --stage dev
```

## Fully cloud-based `dev` testing

Use this when you want the browser, API, and image pipeline all off your
laptop:

1. Run `bun run deploy --stage dev`.
2. On the very first deploy only, add the printed CloudFront `client` URL to
   `clientOrigins.dev` and deploy once more, as described above.
3. Open the CloudFront URL. SST already embedded the `dev` API URL into the
   Vite build, so no client environment variable is needed.

Your local Vite client can still use the same `VITE_SERVER_URL` whenever you
want to work locally. It shares the deployed `dev` API, bucket, queue, and
database with the cloud client.

## Production later

When the client has a public domain and you are ready to launch:

1. Replace `clientOrigins.production` in `sst.config.ts` with the public client
   URL.
2. Create a `production` stage and set its own SST secrets.
3. Use a separate production database URL—not the `dev` database.
4. Deploy production.
5. Deploy. SST embeds the production API URL in the Vite build automatically.

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
bun run deploy --stage dev
bun run dev:aws --stage dev
bun sst secret list --stage dev
bun sst remove --stage dev
```

Use `remove` only for an environment you intend to delete. Keep a small AWS
Budget and a CloudWatch billing alarm enabled.
