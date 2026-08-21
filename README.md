# Aska

A design-forward visual workspace and cloud archive for digital creatives.

## Who it's for

Designers, art directors, UI/UX engineers, and creative researchers who save visual references from across the web and need a single, high-fidelity repository to keep them organized and findable.

## The problem

Creative tools are optimized for text. Designers save references via browser bookmarks (which break), social media saves (which get buried), and local desktop folders (which are a mess). There's no unified place that treats visual content as a first-class asset and preserves it permanently.

## What it does

Aska ingests image uploads, notes, and generic web links as durable visual
assets. Provider-specific social capture and article extraction are future
extensions of the implemented URL-resource pipeline.
The Inbox renders the archive as a masonry grid, while collections provide an
infinite spatial canvas for composing moodboards.

### Core concepts

- **Workspaces** — Tenant-level containers. Personal vaults, studio spaces, etc. Completely isolated.
- **Collections** — Independent infinite canvases within a workspace. Each
  collection is a spatial moodboard such as "Acme Rebrand", "Typography Inspo",
  or "Spring Palette". This is the main organizational unit.
- **Folders** — First-class objects on a collection canvas that open nested
  canvases. Folder placement is independent from the placement of its contents.
- **Assets** — The polymorphic card that currently unifies image uploads,
  generic link bookmarks, and notes, with richer resource types added behind
  the same card boundary.

### Ingest

- **Image upload** — Drag and drop into the Inbox or at a chosen collection
  canvas position. Stored in cloud storage, full resolution preserved.
- **Link bookmark** — Paste or drop an HTTP(S) URL. Aska creates a card
  immediately, resolves generic metadata in the background, and stores safe
  responsive preview variants. The original link remains usable if resolution
  fails.
- **Provider and article ingestion (planned)** — Rich social resolution,
  readable-content extraction, and indexing build on the same resource and
  resolver boundaries; they are not part of generic unfurling.
- **Notes** — Quick text snippets with color labels for raw ideas.

### Surface & find

- **Color search** — Extracted image palettes provide ranked retrieval in the
  Inbox and current collection/folder canvas. It preserves authored canvas
  positions and Inbox ordering. See [how it works](./docs/color-image-search.md).
- Smart collections — Saved queries (by color, type, tags) that auto-populate.
- Full-text search across article content and notes.

## Architecture

Aska is multi-tenant from day one. Every asset, collection, and folder belongs
to a workspace and has creator metadata. Collections contain a spatial tree of
nodes: image, note, and link assets are leaf nodes, while folders organize nested
content. Each placement has an authored position on its collection or folder
canvas. Folders are not assets.

The application consists of a React/Vite client, a Bun/Hono API backed by
Postgres and Drizzle, plus AWS Lambda workers that process S3 uploads and
external URL resources asynchronously through independent SQS queues. Collection
and folder badges show descendant asset counts: images, notes, and links count;
folders do not. The client uses XYFlow for collection
canvas rendering and interaction while Aska's API remains the source of truth
for node identity, hierarchy, and position.

See [the engineering docs](./docs/README.md) for a codebase map, architecture,
data model, backend conventions, operations, and contribution workflow.

The real-AWS development, deployment, stage, secret, and React/Vite hosting
workflow is documented in [SST deployment](./docs/sst-deployment.md).

## Development

For end-to-end browser development, use one root command per mode:

```sh
bun run dev        # local Vite + personal hybrid SST Live backend
bun run dev:cloud  # local Vite + stable deployed cloud backend
```

`bun run dev` stops both processes when you press Ctrl-C. Package commands are
also available for isolated work:

```sh
cd client && bun install && bun run dev
cd server && bun install && bun run dev
cd services/image-variants && bun install
cd services/image-palette && bun install
cd services/url-unfurl-shared && bun install
cd services/url-resolution && bun install
```

For normal end-to-end development, use real AWS S3 and SQS through SST instead
of the isolated package commands; see [SST deployment](./docs/sst-deployment.md).

Run the full package-local quality suite with `bun run lint`,
`bun run typecheck`, `bun run format`, and `bun run test`. The same commands run
in CI. Running `bun install` at the repository root installs the tracked
pre-commit hook, which formats staged source files with Oxfmt.
