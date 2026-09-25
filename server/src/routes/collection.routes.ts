import {
  bulkDelete,
  createCanvasArrow,
  createCanvasText,
  createCollection,
  createColor,
  createFolder,
  createNote,
  createDiagram,
  deleteCollection,
  deleteCollectionNode,
  deleteCanvasObject,
  flattenFolder,
  getCollectionContents,
  getCollections,
  getWorkspaceWithCollections,
  moveCollectionNodesToFolder,
  updateCollectionNodePosition,
  updateCollectionNodePositions,
  updateCanvasArrow,
  updateCanvasText,
  updateCanvasItemFrontIndexes,
  updateCanvasItemsGeometry,
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
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/diagrams",
    ...createDiagram,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/colors",
    ...createColor,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/canvas-objects/text",
    ...createCanvasText,
  )
  .post(
    "/workspace/:workspaceSlug/collections/:collectionSlug/canvas-objects/arrows",
    ...createCanvasArrow,
  )
  .patch(
    "/workspace/:workspaceSlug/collections/:collectionSlug/canvas-objects/text/:objectId",
    ...updateCanvasText,
  )
  .patch(
    "/workspace/:workspaceSlug/collections/:collectionSlug/canvas-objects/arrows/:objectId",
    ...updateCanvasArrow,
  )
  .patch(
    "/workspace/:workspaceSlug/collections/:collectionSlug/canvas/items/front-index",
    ...updateCanvasItemFrontIndexes,
  )
  .patch(
    "/workspace/:workspaceSlug/collections/:collectionSlug/canvas/items/geometry",
    ...updateCanvasItemsGeometry,
  )
  .delete(
    "/workspace/:workspaceSlug/collections/:collectionSlug/canvas-objects/:objectId",
    ...deleteCanvasObject,
  )
  .delete(
    "/workspace/:workspaceSlug/collections/:collectionSlug/nodes/:nodeId",
    ...deleteCollectionNode,
  )
  .delete(
    "/workspace/:workspaceSlug/collections/:collectionSlug",
    ...deleteCollection,
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
