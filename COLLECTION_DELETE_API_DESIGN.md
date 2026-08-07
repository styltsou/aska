# Node Delete API — Design Note

## Summary

The delete surface for collection content is inconsistent with how the domain
actually works. There is a single "delete collection node" endpoint, but it can
only delete **folders**; assets are explicitly rejected and must go through a
separate route. This split was justified by an ambiguity (is deleting an asset =
removing a reference, or removing the underlying object?) that does not really
exist in our data model. The end result is fragmented delete semantics that read
as bad API design.

## Current behavior

One delete route is exposed for "a node inside a collection":

```
DELETE /workspace/:workspaceSlug/collections/:collectionSlug/nodes/:nodeId
```

Handled by `deleteCollectionNode` → `CollectionDeleteService.deleteNode`
(`server/src/services/collection/collection-delete.service.ts`).

The node id parser (`server/src/lib/collection-node-id.ts`) accepts three kinds:

- `folder-<id>`
- `image-<id>`
- `note-<id>`

But the service immediately rejects anything that isn't a folder:

```ts
if (target.nodeType !== "folder") {
  throw new AppError(
    ErrorCode.VALIDATION_ERROR,
    "Only folders can be deleted from a collection. Use the asset delete endpoint for assets.",
  );
}
```

Assets are instead deleted via a completely separate route:

```
DELETE /workspace/:workspaceSlug/assets/:assetId
```

So a consumer cannot delete a folder, an image, and a note through a single
consistent mechanism. The intended semantics for each are:

| node kind | route to hit                         |
|-----------|--------------------------------------|
| folder    | `.../collections/:slug/nodes/:nodeId` |
| image     | `.../assets/:assetId`                 |
| note      | `.../assets/:assetId`                |

This branching is the core of the problem: the consumer has to know two
unrelated routes depending on node kind, and none of them deletes a whole
collection.

## The stated rationale, and why it's thin

The rationale for routing assets away from the node endpoint is that an "asset"
is modeled as an `assets` row plus a `collectionNodes` reference row, so
"deleting" an asset from a collection was treated as ambiguous: do we remove
just the reference, or the underlying asset too?

But in reality, **an asset cannot be shared across collections**. A given asset
belongs to one collection (or the inbox). The reference/asset split exists so an
asset can be dereferenced and moved back to the inbox — i.e. to support *moving*,
not to enable a second, independent concept of "deleting".

So the "ambiguity" the error message invokes is largely theoretical. It was a
transport/mechanism concern (how we move something) dressed up as a domain rule
(how you delete something).

## Why this reads as bad API design

1. **The public contract contradicts the data model.** The endpoint treats
   assets and folders as fundamentally different delete targets. In the model,
   they are just nodes in a collection tree; the reference indirection is an
   implementation detail for moves, not a rule about deletion.

2. **Fragmented surface.** Deleting "a thing in a collection" is not a single
   operation; it is a branch on node kind plus knowledge of an unrelated
   asset-level route. The REST shape does not model the resource it represents.

3. **A move/re-org mechanism leaked into deletion.** The dereference-back-to-
   inbox capability is transport for a move, not delete semantics. Surfacing it
   as the reason a delete route rejects assets couples two unrelated concerns.

## What would be better

Make deletion kind-agnostic and keep "move back to inbox" explicit:

- `DELETE .../collections/:collectionSlug/nodes/:nodeId` deletes folder,
  image, or note nodes uniformly (folder = whole subtree).
- A separate, explicit "return asset to inbox" endpoint covers the case that
  was previously served only via dereference.

And, separately, add a whole-container delete (there is currently no endpoint
to delete a collection at all):

- `DELETE .../collections/:collectionSlug`

## Scope

This document is descriptive only; no code has been changed. If we later act on
it, the work is roughly:

1. Make the node-delete endpoint accept all node kinds (folder subtree, image,
   note).
2. Replace "use the asset delete endpoint" with the appropriate behavior, and
   keep asset deletion resolvable from the same node surface.
3. Extract any genuine "return asset to inbox" operation into its own explicit
   endpoint rather than hiding it behind delete.
4. Add whole-collection deletion (server endpoint + client hook).
5. Update the client flow on the collections page, whose confirmation dialog's
   Delete button currently performs no mutation.