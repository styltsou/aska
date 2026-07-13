import {
  createCollection,
  createFolder,
  createNote,
  deleteCollectionNode,
  getCollectionContents,
  getCollections,
  getWorkspaceWithCollections,
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
  .get(
    "/workspace/:workspaceSlug/collections/:collectionSlug/contents",
    ...getCollectionContents,
  );

export default collectionRoutes;
