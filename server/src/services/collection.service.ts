import type {
  CollectionContentsResponse,
  CollectionNoteNode,
  CreateCollectionInput,
  CreateFolderInput,
  CreateNoteInput,
  CreatedFolder,
  LightCollection,
} from "@/dto/collection.dto";
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
  getCollectionContents(
    orgId: string,
    collectionSlug: string,
    folderPath?: string,
  ): Promise<CollectionContentsResponse>;
}

export class CollectionService implements ICollectionService {
  private readonly queries: CollectionQueryService;
  private readonly mutations = new CollectionMutationService();
  private readonly deletes: CollectionDeleteService;

  constructor(deps: { objectStorageService: IObjectStorageService }) {
    this.queries = new CollectionQueryService({
      objectStorageService: deps.objectStorageService,
    });
    this.deletes = new CollectionDeleteService({
      objectStorageService: deps.objectStorageService,
    });
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

  getCollectionContents(
    orgId: string,
    collectionSlug: string,
    folderPath?: string,
  ): Promise<CollectionContentsResponse> {
    return this.queries.getCollectionContents(
      orgId,
      collectionSlug,
      folderPath,
    );
  }
}
