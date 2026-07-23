# Assets Schema

Collections render a spatial tree of heterogeneous nodes. Assets are archived
content. Folders are organizational containers.

For the design rationale and tradeoffs, see
[Schema Design Rationale](./schema-design-rationale.md).

## Tables

- `assets`: shared row for archived content.
- `image_assets`: image-specific fields keyed by `asset_id`.
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

The database stores object keys, not public URLs. Read services generate
short-lived presigned URLs for display and original variants when returning API
responses. `image_assets.blur_data_url` stores the inline blurred WebP shown
while those URLs decode.

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
[Color Image Search](../color-image-search.md). The original
[Color-Based Image Search Plan](../../COLOR_IMAGE_SEARCH_PLAN.md) records the
delivery decisions and future evaluation work.

See [Image Upload and Processing Pipeline](./image-upload-implementation-plan.md)
for lifecycle and extraction details.

## Asset Types

Use class-table inheritance for real asset variants:

```txt
assets
  image_assets
  note_assets
```

Do not create a generic social asset table by default. Future social imports
should get concrete subtype tables such as `instagram_assets` or `x_assets`
when their fields are understood.

## Folder Nodes

Folders are not assets. A folder is placed into a collection through a
`collection_nodes` row with `node_type = "folder"` and `folder_id` set.

Assets are placed into a collection through a `collection_nodes` row with
`node_type = "asset"` and `asset_id` set. Asset nodes can point to any asset
subtype, currently images and notes.

This keeps the collection view as one spatial stream of image, note, and folder
nodes instead of forcing folders to the top.

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
every image and note placed anywhere in that collection. A folder count includes
every image and note in that folder and all nested folders.

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

## Folder Moves

Folder moves are explicit service transactions. The database uses `ON DELETE
CASCADE` for subtree deletion, but does not rely on `ON UPDATE CASCADE` for
moving folders. Move services must update descendants and path caches together.
