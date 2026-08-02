import type {
  CollectionContentsResponse,
  ContentTypeFilter,
  CollectionNoteNode,
  CreateCollectionInput,
  CreateFolderInput,
  CreateNoteInput,
  CreatedFolder,
  MoveCollectionNodeParentInput,
  MoveCollectionNodesParentInput,
  LightCollection,
  UpdateNodePositionInput,
  UpdateNodePositionsInput,
} from "@/dto/collection.dto";
import {
  CollectionAssetMoveService,
  type MoveCollectionNodeParentResult,
  type MoveCollectionNodesParentResult,
  type FlattenFolderResult,
} from "@/services/collection/collection-asset-move.service";
import { CollectionDeleteService } from "@/services/collection/collection-delete.service";
import { CollectionMutationService } from "@/services/collection/collection-mutation.service";
import { CollectionQueryService } from "@/services/collection/collection-query.service";
import type {
  CreatedCollectionRow,
  DeleteCollectionNodeResult,
  DetailedCollectionRow,
  WorkspaceInfo,
} from "@/services/collection/collection.types";
import type { IObjectStorageService } from "@/services/object-storage.service";
import { LoggerService, type ILoggerService } from "@/services/logger.service";

export type {
  CreatedCollectionRow,
  DeleteCollectionNodeResult,
  DetailedCollectionRow,
  WorkspaceInfo,
} from "@/services/collection/collection.types";

export interface ICollectionService {
  getWorkspaceBySlug(slug: string, userId: string): Promise<WorkspaceInfo>;
  getLightCollections(orgId: string): Promise<LightCollection[]>;
  getDetailedCollections(orgId: string): Promise<DetailedCollectionRow[]>;
  createCollection(
    orgId: string,
    userId: string,
    data: CreateCollectionInput,
  ): Promise<CreatedCollectionRow>;
  createFolder(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateFolderInput,
  ): Promise<CreatedFolder>;
  createNote(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateNoteInput,
  ): Promise<CollectionNoteNode>;
  deleteNode(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
  ): Promise<DeleteCollectionNodeResult>;
  deleteFolders(
    orgId: string,
    collectionSlug: string,
    folderIds: number[],
  ): Promise<number>;
  getCollectionContents(
    orgId: string,
    collectionSlug: string,
    folderPath?: string,
    types?: ContentTypeFilter[],
  ): Promise<CollectionContentsResponse>;
  updateNodePosition(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
    data: UpdateNodePositionInput,
  ): Promise<{ nodeId: string; position: UpdateNodePositionInput["position"] }>;
  updateNodePositions(
    orgId: string,
    collectionSlug: string,
    data: UpdateNodePositionsInput,
  ): Promise<{ nodeIds: string[] }>;
  moveNodeToFolder(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
    data: MoveCollectionNodeParentInput,
  ): Promise<MoveCollectionNodeParentResult>;
  moveNodesToFolder(
    orgId: string,
    collectionSlug: string,
    data: MoveCollectionNodesParentInput,
  ): Promise<MoveCollectionNodesParentResult>;
  flattenFolder(
    orgId: string,
    collectionSlug: string,
    folderNodeId: string,
  ): Promise<FlattenFolderResult>;
}

export class CollectionService implements ICollectionService {
  private readonly queries: CollectionQueryService;
  private readonly mutations = new CollectionMutationService();
  private readonly moves = new CollectionAssetMoveService();
  private readonly deletes: CollectionDeleteService;
  private readonly logger: ILoggerService;

  constructor({
    objectStorageService,
    loggerService = new LoggerService(),
  }: {
    objectStorageService: IObjectStorageService;
    loggerService?: ILoggerService;
  }) {
    this.queries = new CollectionQueryService({
      objectStorageService,
    });
    this.deletes = new CollectionDeleteService({
      objectStorageService,
    });
    this.logger = loggerService;
  }

  getWorkspaceBySlug(slug: string, userId: string): Promise<WorkspaceInfo> {
    return this.queries.getWorkspaceBySlug(slug, userId);
  }

  getLightCollections(orgId: string): Promise<LightCollection[]> {
    return this.queries.getLightCollections(orgId);
  }

  getDetailedCollections(orgId: string): Promise<DetailedCollectionRow[]> {
    return this.queries.getDetailedCollections(orgId);
  }

  createCollection(
    orgId: string,
    userId: string,
    data: CreateCollectionInput,
  ): Promise<CreatedCollectionRow> {
    return this.mutations.createCollection(orgId, userId, data);
  }

  createFolder(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateFolderInput,
  ): Promise<CreatedFolder> {
    return this.mutations.createFolder(orgId, userId, collectionSlug, data);
  }

  createNote(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateNoteInput,
  ): Promise<CollectionNoteNode> {
    return this.mutations.createNote(orgId, userId, collectionSlug, data);
  }

  deleteNode(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
  ): Promise<DeleteCollectionNodeResult> {
    return this.deletes.deleteNode(orgId, collectionSlug, nodeId);
  }

  deleteFolders(
    orgId: string,
    collectionSlug: string,
    folderIds: number[],
  ): Promise<number> {
    return this.deletes.deleteFolders(orgId, collectionSlug, folderIds);
  }

  getCollectionContents(
    orgId: string,
    collectionSlug: string,
    folderPath?: string,
    types?: ContentTypeFilter[],
  ): Promise<CollectionContentsResponse> {
    return this.queries.getCollectionContents(
      orgId,
      collectionSlug,
      folderPath,
      types,
    );
  }

  updateNodePosition(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
    data: UpdateNodePositionInput,
  ): Promise<{
    nodeId: string;
    position: UpdateNodePositionInput["position"];
  }> {
    return this.mutations.updateNodePosition(
      orgId,
      collectionSlug,
      nodeId,
      data,
    );
  }

  updateNodePositions(
    orgId: string,
    collectionSlug: string,
    data: UpdateNodePositionsInput,
  ): Promise<{ nodeIds: string[] }> {
    return this.mutations.updateNodePositions(orgId, collectionSlug, data);
  }

  moveNodeToFolder(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
    data: MoveCollectionNodeParentInput,
  ): Promise<MoveCollectionNodeParentResult> {
    return this.moves.moveNodeToFolder(orgId, collectionSlug, nodeId, data);
  }

  moveNodesToFolder(
    orgId: string,
    collectionSlug: string,
    data: MoveCollectionNodesParentInput,
  ): Promise<MoveCollectionNodesParentResult> {
    return this.moves.moveNodesToFolder(orgId, collectionSlug, data);
  }

  async flattenFolder(
    orgId: string,
    collectionSlug: string,
    folderNodeId: string,
  ): Promise<FlattenFolderResult> {
    const result = await this.moves.flattenFolder(
      orgId,
      collectionSlug,
      folderNodeId,
    );
    this.logger.info("Folder flattened", {
      event_name: "collection.folder.flattened",
      collection_slug: collectionSlug,
      folder_node_id: folderNodeId,
      parent_folder_node_id: result.parentFolderNodeId,
      direct_child_count: result.directChildCount,
      destination_anchor: result.position,
    });
    return result;
  }
}
