# Aska

A design-forward visual workspace and cloud archive for digital creatives.

## Who it's for

Designers, art directors, UI/UX engineers, and creative researchers who save visual references from across the web and need a single, high-fidelity repository to keep them organized and findable.

## The problem

Creative tools are optimized for text. Designers save references via browser bookmarks (which break), social media saves (which get buried), and local desktop folders (which are a mess). There's no unified place that treats visual content as a first-class asset and preserves it permanently.

## What it does

Aska ingests content from multiple streams — image uploads, social media links
(X, Instagram), and article URLs — and preserves them as durable visual assets.
The Inbox renders the archive as a masonry grid, while collections provide an
infinite spatial canvas for composing moodboards.

### Core concepts

- **Workspaces** — Tenant-level containers. Personal vaults, studio spaces, etc. Completely isolated.
- **Collections** — Independent infinite canvases within a workspace. Each
  collection is a spatial moodboard such as "Acme Rebrand", "Typography Inspo",
  or "Spring Palette". This is the main organizational unit.
- **Folders** — First-class objects on a collection canvas that open nested
  canvases. Folder placement is independent from the placement of its contents.
- **Assets** — The polymorphic card that unifies everything: image uploads, social captures, article bookmarks, and notes.

### Ingest

- **Image upload** — Drag and drop into the Inbox or at a chosen collection
  canvas position. Stored in cloud storage, full resolution preserved.
- **X / Instagram capture** — Paste a link. Aska extracts the media, text context, and author. Mirrored safely so deletion of the original post doesn't lose the reference.
- **Article bookmark** — Paste a URL. Aska extracts readable content and meta info, generates a preview card, and indexes the text for search.
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
nodes: image and note assets are leaf nodes, while folders organize nested
content. Each placement has an authored position on its collection or folder
canvas. Folders are not assets.

The application consists of a React/Vite client, a Bun/Hono API backed by
Postgres and Drizzle, and a Cloudflare Worker that processes image uploads from
R2 asynchronously. Collection and folder badges show descendant asset counts:
images and notes count, folders do not. The client uses XYFlow for collection
canvas rendering and interaction while Aska's API remains the source of truth
for node identity, hierarchy, and position.

See [the engineering docs](./docs/README.md) for the data model, backend
conventions, and local development workflow.

## Development

Each package is independently installed and run with Bun:

```sh
cd client && bun install && bun run dev
cd server && bun install && bun run dev
cd workers/image-pipeline && bun install && bun run dev
```

Run the full package-local quality suite with `bun run lint`,
`bun run typecheck`, `bun run format`, and `bun run test`. The same commands run
in CI. Running `bun install` at the repository root installs the tracked
pre-commit hook, which formats staged source files with Oxfmt.
