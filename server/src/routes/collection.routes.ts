import {
  bulkDelete,
  createCollection,
  createFolder,
  createNote,
  deleteCollectionNode,
  flattenFolder,
  getCollectionContents,
  getCollections,
  getWorkspaceWithCollections,
  moveCollectionNodesToFolder,
  updateCollectionNodePosition,
  updateCollectionNodePositions,
} from "@/controllers/collection.controller";
import { factory } from "@/factory";

const collectionRoutes = factory
  .createApp()
  .get("/workspace/:workspaceSlug", ...getWorkspaceWithCollections)
  .get("/workspace/:workspaceSlug/collections", ...getCollections)
  .post("/workspace/:workspaceSlug/collections", ...createCollection)
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/folders",
    ...createFolder,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/notes",
    ...createNote,
  )
  .delete(
    "/workspace/:workspaceSlug/collections/:collectionSlug/nodes/:nodeId",
    ...deleteCollectionNode,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/nodes/:nodeId/flatten",
    ...flattenFolder,
  )
  .patch(
    "/workspace/:workspaceSlug/collections/:collectionSlug/nodes/positions",
    ...updateCollectionNodePositions,
  )
  .patch(
    "/workspace/:workspaceSlug/collections/:collectionSlug/nodes/:nodeId/position",
    ...updateCollectionNodePosition,
  )
  .patch(
    "/workspace/:workspaceSlug/collections/:collectionSlug/nodes/parent",
    ...moveCollectionNodesToFolder,
  )
  .get(
    "/workspace/:workspaceSlug/collections/:collectionSlug/contents",
    ...getCollectionContents,
  )
  .post("/workspace/:workspaceSlug/bulk-delete", ...bulkDelete);

export default collectionRoutes;
