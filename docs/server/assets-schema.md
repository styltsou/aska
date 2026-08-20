# Assets Schema

Collections render a spatial tree of heterogeneous nodes. Assets are archived
content. Folders are organizational containers.

For the design rationale and tradeoffs, see
[Schema Design Rationale](./schema-design-rationale.md).

## Tables

- `assets`: shared row for archived content.
- `image_assets`: image-specific fields keyed by `asset_id`.
- `link_assets`: card-specific original URL and normalized-resource reference.
- `external_resources`: workspace-scoped resolved URL identity and metadata.
- `resource_resolution_attempts`: generation-guarded URL resolution work.
- `external_resource_media`: role-aware discovered media and stored variants.
- `media_cleanup_jobs`: retryable deletion work for replaced media objects.
- `note_assets`: markdown note fields keyed by `asset_id`.
- `folders`: folder identity, display name, and slug.
- `collection_nodes`: collection placement, nesting, and path cache.

`image_assets.variants` is JSONB render metadata for image renditions:

```txt
{
  original: { objectKey, width, height, contentType, sizeBytes },
  display: { objectKey, width, height, contentType, sizeBytes },
  preview: { objectKey, width, height, contentType, sizeBytes }
}
```

The database stores object keys, not public URLs. In a deployed stage, read
services return stable CloudFront URLs for originals and generated variants;
access is granted by a workspace-scoped signed-cookie session rather than by
embedding authorization in each URL. Local and hybrid environments use
short-lived presigned S3 URLs instead.

Every media key is rooted at the immutable workspace ID:
`{workspaceId}/{storageId}/original.{extension}`,
`{workspaceId}/{storageId}/display.webp`, and
`{workspaceId}/{storageId}/preview.webp`. The key expresses ownership and
access scope, not folder or collection location. Folder and collection moves
update database placement only and never rename media objects.
`image_assets.blur_data_url` stores the inline blurred WebP shown while those
URLs decode.

Resource-media keys use the same authorization namespace and immutable-storage
convention: `{workspaceId}/{storageId}/master.webp` plus optional
`display.webp` and `preview.webp`. The separate table is intentional: a generic
Open Graph preview is supporting link media, not an `image_assets` primary
image, and therefore must not enter palette or visual-analysis pipelines.

An in-place crop rotates the active `storage_id` on the associated `uploads`
workflow record. It immediately stores only the new cropped original in
`image_assets.variants`; the normal workers later fill display and preview.
There is no image edit, revision, or original-master table. The old namespace's
exact keys are placed in `media_cleanup_jobs` and deleted by the scheduled
cleanup Lambda. A cleanup job can outlive an asset row because deleting the
asset must not leak a previously displaced namespace.

## Image Ingestion and Colors

`uploads` is the durable asynchronous ingestion workflow. It stores the target
collection/folder, source metadata, original object key, lifecycle status,
processing ETag, terminal error, and final asset ID. It is not an asset and is
created before an original is written to S3.

`image_colors` is the searchable palette table. It stores `organization_id`,
the display-ready hex value, indexed OKLab coordinates, `coverage`, `salience`,
`is_accent`, and `extraction_version`. A composite foreign key keeps its tenant
equal to the parent asset, while a tenant-first GiST index bounds color scans to
one organization. Use this table, not the compact
`image_assets.dominant_colors` display cache, for color search and moodboard
similarity.

The implemented search endpoint, local scope rules, ranking algorithm,
thresholds, and client behavior are documented in
[Color Image Search](../color-image-search.md). The original color-based image
search delivery plan records the
delivery decisions and future evaluation work.

See [Image Upload and Processing Pipeline](./image-upload-implementation-plan.md)
for lifecycle and extraction details.

## Asset Types

Use class-table inheritance for real asset variants:

```txt
assets
  image_assets
  note_assets
  link_assets -> external_resources
```

Do not create a generic social asset table by default. Provider-specific URL
fields belong in the controlled resource extension area until a genuinely new
card contract is understood. See [URL Unfurling](./url-unfurling.md).

## Folder Nodes

Folders are not assets. A folder is placed into a collection through a
`collection_nodes` row with `node_type = "folder"` and `folder_id` set.

Assets are placed into a collection through a `collection_nodes` row with
`node_type = "asset"` and `asset_id` set. Asset nodes can point to any asset
subtype, currently images, notes, and links.

This keeps the collection view as one spatial stream of image, note, link, and
folder nodes instead of forcing folders to the top.

Child nodes use `parent_folder_id`, not `parent_node_id`, because only folders
can contain children. The database also enforces that the parent folder is
placed in the same collection.

## Path Cache

`collection_nodes` stores denormalized folder path fields:

```txt
path_folder_ids
path_folder_slugs
path_folder_names
depth
```

For folder nodes, path arrays include the folder itself. For asset nodes, path
arrays include only containing folders. The ID path is the stable identity path.
Slugs are for read/navigation URLs. Names are for breadcrumb labels. On folder
rename or move, services must update the folder row and all affected descendant
node path caches in one transaction.

Use slugs for reads and IDs for mutations.

## Asset Counts

Displayed counts always mean assets, never folders. A collection count includes
every image, note, and link placed anywhere in that collection. A folder count
includes every asset in that folder and all nested folders.

The read service computes collection counts with `collection_id` and
`node_type = "asset"`. It computes the counts for all folder cards in one
batched query by grouping asset nodes over their `path_folder_ids` ancestors.
The `collection_nodes(collection_id, node_type)` B-tree index supports the
collection-wide scan, while the `path_folder_ids` GIN index supports the
descendant-path filter. Do not count folder nodes or issue a recursive query per
folder card.

## Canvas Positions

`collection_nodes.position_x` and `position_y` hold the authored canvas
coordinate for every placed folder and asset. They are signed PostgreSQL
integers stored as a nullable pair: either both coordinates are set or both are
null. There is deliberately no nonnegative constraint because the canvas
supports placement in every direction.

The client rounds completed drags to whole pixels and persists them through the
node position endpoint. Existing rows without coordinates receive a
deterministic client fallback layout based on the API's stable `created_at, id`
order. `uploads` stores the same optional coordinate pair so a position reserved
before asynchronous image processing survives finalization.

Viewport position and zoom are client session state, not collection data. See
[Collection Canvas Architecture](../collection-canvas.md) for the client/server
ownership boundary.

## Tenant Integrity

`collection_nodes.organization_id` is intentionally redundant for fast tenant
scoping. Composite foreign keys enforce that a node's collection, asset, and
folder references all belong to the same organization.

`image_colors.organization_id` is likewise redundant by design: it makes the
tenant predicate part of the palette GiST index. Its composite foreign key to
`assets(id, organization_id)` prevents the denormalized value from drifting
from its parent image asset.

Link/resource relations repeat `organization_id` and use composite foreign
keys for the same reason. Resource URL reuse and media sharing are deliberately
workspace-local; no lookup may deduplicate across organizations.

## Folder Moves

Folder moves are explicit service transactions. The database uses `ON DELETE
CASCADE` for subtree deletion, but does not rely on `ON UPDATE CASCADE` for
moving folders. Batch move services may include assets and folders, and must
update every moved folder's descendants and path caches together or roll back
the whole move.

## Move and Position Semantics

These mutations intentionally use separate contracts:

- Collection node `position` endpoints only update canvas coordinates. They
  require the expected parent to reject delayed writes after a move, but never
  change a node's parent or cached folder path.
- The collection node `parent` endpoint is the single move contract. Its path
  selects the destination collection; its body carries one to 100 node IDs and
  a destination folder node ID (or `null` for that collection's root). It
  infers Inbox assets from their missing placement and performs the complete
  batch atomically. Assets may cross collections; folders are restricted to
  moves within their existing collection so their subtree invariants remain
  intact.

## Note Updates

`PATCH /api/v1/workspace/:workspaceSlug/assets/:assetId/note` replaces a
note's complete Markdown document. The service scopes the asset to the active
workspace, rejects non-note asset IDs, updates the asset's editor/timestamp
metadata, and recalculates word-count and reading-time metrics in the same
response. The endpoint is shared by Inbox and placed notes because note content
belongs to the asset rather than to a collection placement.
