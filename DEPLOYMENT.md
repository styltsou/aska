# Deployment

## The model

There are three independently deployable services:

| Service | Runtime | Production deployment |
| --- | --- | --- |
| Client | React/Vite static site | Cloudflare Pages Git integration |
| API | Hono | Cloudflare Worker, deployed by GitHub Actions |
| Image pipeline | Queue consumer | Cloudflare Worker, deployed by GitHub Actions |

The client and pipeline both call the API through one stable public origin. The
production values live in the committed Worker configuration; secrets live only
in Cloudflare. CI deploys code and configuration, but never rewrites a config
file or uploads local secrets.

```text
Browser ──HTTPS──> app.example.com (Pages)
                       │
                       └──HTTPS──> api.example.com (Hono)
                                           │
                  ┌────────────────────────┴────────────────────────┐
                  │                                                 │
              Neon Postgres                              R2 + Queue → image pipeline
                                                                      │
                                                                      └──HTTPS──> api.example.com
```

`api.example.com` is deliberately a stable hostname. It can initially point to
the Worker and later point to a VPS without changing the client build or the
pipeline callback URL.

## Before the first deployment

Run the command blocks in this section from the repository root unless a block
changes directory itself.

### 1. Choose the public origins

Use custom domains when possible:

```text
APP_ORIGIN=https://app.example.com
API_ORIGIN=https://api.example.com
```

Configure DNS for the two origins, then replace the example values in the
repository:

| File | Values to set |
| --- | --- |
| `server/wrangler.jsonc` | `CORS_ORIGINS=APP_ORIGIN`, `BETTER_AUTH_URL=API_ORIGIN` |
| `workers/image-pipeline/wrangler.jsonc` | `PIPELINE_API_BASE_URL=API_ORIGIN` |
| Pages production environment | `VITE_SERVER_URL=API_ORIGIN` |

`VITE_SERVER_URL` is public build-time configuration, not a secret. If custom
domains are not available yet, use the Pages `*.pages.dev` URL and the
Worker's `*.workers.dev` URL instead. Find the latter from **Workers & Pages**
before deploying, and commit it as the stable API origin. Do not make CI parse
or propagate generated deployment URLs.

### 2. Create Cloudflare resources once

Log in locally, then create the R2 bucket and queue. These commands use the
repository-pinned Wrangler version, are safe to run manually, and are
intentionally not hidden in a bootstrap script.

```sh
cd server && bun install && bunx wrangler login
bunx wrangler r2 bucket create aska

cd ../workers/image-pipeline && bun install
bunx wrangler queues create aska-image-processing
```

Create R2 S3 API credentials in the Cloudflare dashboard. Keep the access-key
pair private; the account ID and bucket name in `server/wrangler.jsonc` are
not secrets.

### 3. Create the production secret files locally

The example files name every required secret but contain no usable values:

```sh
cp server/.env.production.example server/.env.production
cp workers/image-pipeline/.env.production.example workers/image-pipeline/.env.production
```

Fill in the files. `IMAGE_PIPELINE_CALLBACK_SECRET` and
`PIPELINE_CALLBACK_SECRET` must be the same random value. Both files are
ignored by Git.

### 4. Deploy the two Workers

The first deploy uploads code and all secrets together. It shows Wrangler's
normal progress output and does not modify any repository files.

```sh
cd server
bun install
bunx wrangler deploy --secrets-file .env.production

cd ../workers/image-pipeline
bun install
bunx wrangler deploy --secrets-file .env.production
```

If using a custom API domain, attach `API_ORIGIN` to `aska-server` in the
Cloudflare dashboard now that the Worker exists.

After the pipeline Worker is attached to the queue, create the one R2 event
rule that sends original uploads to it:

```sh
cd workers/image-pipeline
bunx wrangler r2 bucket notification create aska \
  --event-type object-create \
  --queue aska-image-processing \
  --prefix ingest/
```

The prefix is required: generated assets are stored under `assets/`, so they
must not enqueue another image-processing job.

### 5. Create the Pages project with Git integration

In Cloudflare Pages, connect this repository and use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `client` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Production variable | `VITE_SERVER_URL=API_ORIGIN` |

Cloudflare Pages Git integration handles production deploys from `main` and
preview builds for pull requests. Choose it before the first Pages deployment:
Cloudflare does not allow a Direct Upload Pages project to be converted to Git
integration later. If `aska-client` was already created as Direct Upload,
either keep it and add a client deploy job, or create a new Git-integrated
Pages project. This repository uses the Git-integrated option.

## Continuous integration and deployment

`.github/workflows/ci.yml` is the only GitHub Actions workflow:

1. Every pull request and push runs linting, typechecking, formatting, tests,
   and a client production build.
2. On a successful push to `main`, the server deploys only when `server/**`
   changed and the pipeline deploys only when `workers/image-pipeline/**`
   changed.
3. Worker deployments are serialized, preventing overlapping production
   uploads. Pages deploys separately through its Git integration.

Configure these GitHub repository secrets once:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the Workers |
| `CLOUDFLARE_API_TOKEN` | Least-privilege token permitted to deploy the two Workers |

The application secrets are not GitHub secrets and do not pass through CI.
Wrangler preserves Worker secrets on ordinary deploys. To rotate one, update
the ignored production secret file and run the relevant command locally:

```sh
cd server
bunx wrangler secret bulk .env.production

cd ../workers/image-pipeline
bunx wrangler secret bulk .env.production
```

Use `bun run deploy:dry` from either Worker directory to validate a deployment
without publishing it.

## Local development

Use `server/.env` for the Bun API in local development; do not maintain a
duplicate `server/.dev.vars`. The committed Worker configuration is production
configuration, so use `bun run dev` for normal API development. For the
pipeline, use its ignored `.env` or `.dev.vars` file as appropriate.

```sh
cd server && bun run dev
cd client && npm run dev
cd workers/image-pipeline && bun run dev
```

The pipeline needs an externally reachable API URL when it runs on Cloudflare;
a localhost-only URL cannot receive its callback.

## Moving the API to a VPS later

The API already reads standard environment variables and listens on `PORT` in
the Bun/Node path. A VPS deployment only needs the same production secret and
non-secret configuration values, plus an S3-compatible R2 endpoint/credentials.

Migration sequence:

1. Deploy the Hono API to the VPS and verify `GET /health` privately.
2. Keep `api.example.com` unchanged, move its DNS/proxy target to the VPS, and
   verify authentication plus an image upload.
3. Keep the image pipeline on Cloudflare; it continues to call the same API
   origin. Remove the API Worker only after the cutover is stable.

No client rebuild is required because its public API origin stays the same.

## Security note

`server/.env` was tracked in this repository before this deployment setup.
It is now ignored, but ignoring a file does not remove values already committed
to Git history. If it has ever contained real credentials, rotate them now and
remove the file from Git tracking before the next commit.
