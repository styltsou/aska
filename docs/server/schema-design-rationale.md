# Schema Design Rationale

This document explains the database design choices behind Aska's collection,
folder, and asset model.

## Goals

- Keep archived content separate from board organization.
- Return a collection as one spatial stream of images, notes, and folders.
- Support nested folders.
- Support slug-based reads and ID-based mutations.
- Keep common reads simple and fast.
- Preserve database-enforced tenant boundaries.
- Keep future asset types additive.

## Assets Use Class-Table Inheritance

Assets are durable archived content. The `assets` table stores shared fields:

```txt
id
organization_id
type
title
created_by_user_id
updated_by_user_id
created_at
updated_at
```

Type-specific fields live in subtype tables:

```txt
image_assets(asset_id, width, height, variants, ...)
note_assets(asset_id, markdown, color)
```

This avoids a wide nullable `assets` table while keeping shared asset queries
straightforward. Future concrete asset types should be added as new subtype
tables, for example `instagram_assets` or `x_assets`, once their fields are
known.

Image rendition metadata lives in `image_assets.variants` as JSONB because
renditions are render-time metadata, not entities that need independent query
patterns. Object storage keys are persisted there; public URLs are not stored.
Read services generate short-lived presigned URLs for the requested variants.

## Image Processing Is Asynchronous

An image becomes an asset only after the image pipeline Worker has generated its
variants and returned an authenticated callback to Hono. `uploads` records that
workflow separately from `assets`, which prevents partially processed images
from appearing in collections and lets the Worker retry safely.

R2 originals and generated variants use separate namespaces (`ingest/` and
`assets/`). The R2 event rule matches only `ingest/`, preventing generated
variants from recursively scheduling more work.

## Image Colors Support More Than Display

The compact `dominant_colors` array on `image_assets` is a UI cache. The
normalized `image_colors` table is the query model for color search and future
moodboard similarity. Each color stores `organization_id`, perceptual OKLab
coordinates, area coverage, salience, an accent flag, and an extraction
version. A composite foreign key keeps the denormalized organization equal to
the parent asset, and the tenant-first GiST palette index avoids scanning other
organizations during color retrieval. This preserves the distinction between a
color that occupies most of an image and a small, visually important accent.

See [Image Upload and Processing Pipeline](./image-upload-implementation-plan.md)
for the callback contract and extraction algorithm.

## Folders Are Not Assets

Folders are organizational containers, not archived content. They do not share
the lifecycle or behavior of image/note assets: no ingest pipeline, no source
mirroring, no extracted media metadata, and no text extraction.

The folder identity is stored in `folders`:

```txt
id
organization_id
name
slug
created_by_user_id
updated_by_user_id
created_at
updated_at
```

`name` is the display label. `slug` is the navigation-friendly value derived
from the name. IDs remain the stable identity.

## Collection Nodes Model Placement

`collection_nodes` exists because collection membership is not flat membership.
It is placement in a spatial tree.

A node stores:

```txt
collection_id
parent_folder_id
node_type
asset_id
folder_id
position_x
position_y
path_folder_ids
path_folder_slugs
path_folder_names
depth
```

This lets one query return mixed image, note, and folder nodes with authored
canvas coordinates. Positions belong to placements rather than assets or
folder identities because the same archived content and container identity are
separate from how a moodboard is composed.

Coordinates are signed integers and stored as a nullable pair. A database
constraint requires both coordinates to be set or both to be null, but does not
require nonnegative values. This supports free placement in every direction
while preserving legacy rows that still need deterministic client fallback
positions.

Without this table, placement columns would need to be duplicated across assets
and folders, and every canvas read would need a union of two different table
shapes.

## Parent Folders, Not Parent Nodes

Children reference `parent_folder_id`, not `parent_node_id`, because only
folders can contain children.

The database enforces that the parent folder is placed in the same collection:

```txt
collection_nodes(collection_id, parent_folder_id)
  -> collection_nodes(collection_id, folder_id)
```

This prevents invalid states where an asset node becomes a parent.

## Path Cache Is Intentional Denormalization

The canonical parent relation is `parent_folder_id`. The path arrays are cached
read models:

```txt
path_folder_ids
path_folder_slugs
path_folder_names
depth
```

For folder nodes, the arrays include the folder itself. For asset nodes, they
include only containing folders.

These fields make common operations cheap:

- Breadcrumb labels use `path_folder_names`.
- Slug reads use `path_folder_slugs`.
- Descendant lookups/deletes use `path_folder_ids`.
- Folder depth is available without recursive queries.

The tradeoff is that folder rename and move operations must update descendant
path caches transactionally.

## Recursive Asset Counts

Collection and folder cards display the number of descendant assets, not the
number of immediate child nodes. Images and notes count as assets; folders do
not. This keeps a folder with content only in nested folders from appearing
empty.

`collection_nodes.node_type` discriminates rows as `"asset"` or `"folder"`.
Collection counts filter on `node_type = "asset"`. For the visible folder cards,
the query service batches descendant counts by expanding each matching asset's
`path_folder_ids` and grouping by ancestor folder ID. This avoids N recursive
queries for N folder cards. The supporting indexes are
`(collection_id, node_type)` and the GIN index on `path_folder_ids`.

The client mirrors these semantics optimistically: collection changes update
both the collection-list cache and workspace/sidebar cache, while nested asset
changes update every cached ancestor folder count. Server reconciliation remains
the source of truth after each mutation.

## Reads Use Slugs, Mutations Use IDs

Client URLs should use slugs because they are readable:

```txt
/workspaces/acme/collections/brand/typography/serif
```

Mutations should use IDs because IDs are stable and unambiguous:

```txt
PATCH /api/v1/collection-nodes/:nodeId
DELETE /api/v1/collection-nodes/:nodeId
```

API responses should include both IDs and slug/name path data so the client can
render URLs and send precise mutations.

## Tenant Integrity Is Enforced

`collection_nodes.organization_id` and `image_colors.organization_id` are
intentionally redundant. They keep common tenant-scoped reads simple and
indexable.

Because redundant tenant fields can drift, composite foreign keys enforce that
node references stay in one organization:

```txt
(collection_id, organization_id) -> collections(id, organization_id)
(asset_id, organization_id)      -> assets(id, organization_id)
(folder_id, organization_id)     -> folders(id, organization_id)

image_colors(asset_id, organization_id) -> assets(id, organization_id)
```

This keeps the denormalization useful without weakening isolation.

## Folder Moves Are Explicit Transactions

Moving a folder subtree across collections is a rare write. Normal canvas reads
are common. The schema therefore stores `collection_id` on every node and pays
the update cost during moves.

A move service should:

1. Lock the moved folder node and its descendants.
2. Validate the target collection and parent folder.
3. Update `collection_id` for the subtree.
4. Recompute `path_folder_ids`, `path_folder_slugs`, `path_folder_names`, and
   `depth`.
5. Commit the transaction.

The parent-folder foreign key uses `ON DELETE CASCADE`, not `ON UPDATE CASCADE`,
so subtree moves remain explicit service behavior.

## Remaining Service Invariants

The database enforces node target shape and tenant consistency. Some invariants
remain service-owned:

- An `assets.type = "image"` row must have exactly one `image_assets` row.
- An `assets.type = "note"` row must have exactly one `note_assets` row.
- Folder slug conflicts among siblings should be resolved when creating,
  renaming, or moving folders.
- Path caches must be refreshed after folder rename or move.
