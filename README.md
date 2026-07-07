# Aska

A design-forward visual workspace and cloud archive for digital creatives.

## Who it's for

Designers, art directors, UI/UX engineers, and creative researchers who save visual references from across the web and need a single, high-fidelity repository to keep them organized and findable.

## The problem

Creative tools are optimized for text. Designers save references via browser bookmarks (which break), social media saves (which get buried), and local desktop folders (which are a mess). There's no unified place that treats visual content as a first-class asset and preserves it permanently.

## What it does

Aska ingests content from multiple streams — image uploads, social media links (X, Instagram), and article URLs — and renders them as uniform, visually consistent cards in a masonry grid. Every piece of content is treated as a permanent asset with its full context preserved.

### Core concepts

- **Workspaces** — Tenant-level containers. Personal vaults, studio spaces, etc. Completely isolated.
- **Collections** — Independent masonry canvases within a workspace. Each collection is a moodboard: "Acme Rebrand", "Typography Inspo", "Spring Palette". This is the main organizational unit.
- **Folders** — Loose spatial groupings *inside* a collection canvas. Drop assets into them to cluster related items without leaving the grid.
- **Assets** — The polymorphic card that unifies everything: image uploads, social captures, article bookmarks, and notes.

### Ingest

- **Image upload** — Drag and drop straight into the grid. Stored in cloud storage, full resolution preserved.
- **X / Instagram capture** — Paste a link. Aska extracts the media, text context, and author. Mirrored safely so deletion of the original post doesn't lose the reference.
- **Article bookmark** — Paste a URL. Aska extracts readable content and meta info, generates a preview card, and indexes the text for search.
- **Notes** — Quick text snippets with color labels for raw ideas.

### Surface & find

- Color filtering — Auto-extracted dominant colors from each image let you filter the entire archive by palette.
- Smart collections — Saved queries (by color, type, tags) that auto-populate.
- Full-text search across article content and notes.

## Architecture

Multi-tenant from day one. Every asset is linked to a `workspace_id` and `created_by`. Collections sit between workspaces and assets — a simple routing table pointing polymorphic assets to their collection canvas.

Tech: React + TypeScript frontend with a masonry grid layout. Backend TBD.
