import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  BulkDeleteResponse,
  CollectionContentsResponse,
  ContentTypeFilter,
  CollectionsData,
  CreateCollectionInput,
  CreateCollectionResponse,
  CreateFolderInput,
  CreateFolderResponse,
  CreateImageUploadInput,
  CreateImageUploadResponse,
  CreateNoteInput,
  CreateNoteResponse,
  CreateRemoteImageInput,
  CreateRemoteImageResponse,
  DeleteCollectionNodeResponse,
  DeleteAssetResponse,
  InboxContentsResponse,
  ImageUploadStatusResponse,
  PlaceAssetInput,
  PlaceAssetResponse,
  MoveCollectionNodeToFolderInput,
  MoveCollectionNodeToFolderResponse,
  UpdateNodePositionInput,
  UpdateNodePositionResponse,
  UpdateNodePositionsInput,
  UpdateNodePositionsResponse,
} from "./types";

export async function fetchCollections(slug: string): Promise<CollectionsData> {
  return apiGet<CollectionsData>(`/api/v1/workspace/${slug}/collections`);
}

export async function createCollection(
  workspaceSlug: string,
  data: CreateCollectionInput,
): Promise<CreateCollectionResponse> {
  return apiPost<CreateCollectionResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections`,
    data,
  );
}

export async function createFolder(
  workspaceSlug: string,
  collectionSlug: string,
  data: CreateFolderInput,
): Promise<CreateFolderResponse> {
  return apiPost<CreateFolderResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/folders`,
    data,
  );
}

export async function createNote(
  workspaceSlug: string,
  collectionSlug: string,
  data: CreateNoteInput,
): Promise<CreateNoteResponse> {
  return apiPost<CreateNoteResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/notes`,
    data,
  );
}

export async function createImageUpload(
  workspaceSlug: string,
  collectionSlug: string,
  data: CreateImageUploadInput,
): Promise<CreateImageUploadResponse> {
  return apiPost<CreateImageUploadResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/images/uploads`,
    data,
  );
}

export async function createRemoteImage(
  workspaceSlug: string,
  collectionSlug: string,
  data: CreateRemoteImageInput,
): Promise<CreateRemoteImageResponse> {
  return apiPost<CreateRemoteImageResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/images/remote`,
    data,
  );
}

export async function fetchImageUploadStatus(
  workspaceSlug: string,
  collectionSlug: string,
  uploadId: number,
): Promise<ImageUploadStatusResponse> {
  return apiGet<ImageUploadStatusResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/images/uploads/${uploadId}`,
  );
}

export async function fetchInboxContents(
  workspaceSlug: string,
  types?: readonly ContentTypeFilter[],
): Promise<InboxContentsResponse> {
  const query = buildTypesQuery(types);
  return apiGet<InboxContentsResponse>(
    `/api/v1/workspace/${workspaceSlug}/inbox${query}`,
  );
}

export async function markInboxSeen(workspaceSlug: string): Promise<void> {
  await apiPost(`/api/v1/workspace/${workspaceSlug}/inbox/seen`);
}

export async function createInboxNote(
  workspaceSlug: string,
  data: CreateNoteInput,
): Promise<CreateNoteResponse> {
  return apiPost<CreateNoteResponse>(
    `/api/v1/workspace/${workspaceSlug}/inbox/notes`,
    data,
  );
}

export async function createInboxImageUpload(
  workspaceSlug: string,
  data: CreateImageUploadInput,
): Promise<CreateImageUploadResponse> {
  return apiPost<CreateImageUploadResponse>(
    `/api/v1/workspace/${workspaceSlug}/inbox/images/uploads`,
    data,
  );
}

export async function createInboxRemoteImage(
  workspaceSlug: string,
  data: CreateRemoteImageInput,
): Promise<CreateRemoteImageResponse> {
  return apiPost<CreateRemoteImageResponse>(
    `/api/v1/workspace/${workspaceSlug}/inbox/images/remote`,
    data,
  );
}

export async function fetchInboxImageUploadStatus(
  workspaceSlug: string,
  uploadId: number,
): Promise<ImageUploadStatusResponse> {
  return apiGet<ImageUploadStatusResponse>(
    `/api/v1/workspace/${workspaceSlug}/inbox/images/uploads/${uploadId}`,
  );
}

export async function placeAsset(
  workspaceSlug: string,
  assetId: string,
  data: PlaceAssetInput,
): Promise<PlaceAssetResponse> {
  return apiPost<PlaceAssetResponse>(
    `/api/v1/workspace/${workspaceSlug}/assets/${encodeURIComponent(assetId)}/placements`,
    data,
  );
}

export async function deleteAsset(
  workspaceSlug: string,
  assetId: string,
): Promise<DeleteAssetResponse> {
  return apiDelete<DeleteAssetResponse>(
    `/api/v1/workspace/${workspaceSlug}/assets/${encodeURIComponent(assetId)}`,
  );
}

export async function deleteCollectionNode(
  workspaceSlug: string,
  collectionSlug: string,
  nodeId: string,
): Promise<DeleteCollectionNodeResponse> {
  return apiDelete<DeleteCollectionNodeResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/nodes/${encodeURIComponent(nodeId)}`,
  );
}

export async function bulkDeleteNodes(
  workspaceSlug: string,
  nodeIds: string[],
  collectionSlug?: string,
): Promise<BulkDeleteResponse> {
  return apiPost<BulkDeleteResponse>(
    `/api/v1/workspace/${workspaceSlug}/bulk-delete`,
    { nodeIds, ...(collectionSlug ? { collectionSlug } : {}) },
  );
}

export async function updateCollectionNodePosition(
  workspaceSlug: string,
  collectionSlug: string,
  nodeId: string,
  data: Pick<
    UpdateNodePositionInput,
    "position" | "expectedParentFolderNodeId"
  >,
): Promise<UpdateNodePositionResponse> {
  return apiPatch<UpdateNodePositionResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/nodes/${encodeURIComponent(nodeId)}/position`,
    data,
  );
}

export async function updateCollectionNodePositions(
  workspaceSlug: string,
  collectionSlug: string,
  data: Pick<
    UpdateNodePositionsInput,
    "positions" | "expectedParentFolderNodeId"
  >,
): Promise<UpdateNodePositionsResponse> {
  return apiPatch<UpdateNodePositionsResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/nodes/positions`,
    data,
  );
}

export async function moveCollectionNodeToFolder(
  workspaceSlug: string,
  collectionSlug: string,
  nodeId: string,
  data: Pick<
    MoveCollectionNodeToFolderInput,
    "targetFolderNodeId" | "expectedParentFolderNodeId"
  >,
): Promise<MoveCollectionNodeToFolderResponse> {
  return apiPatch<MoveCollectionNodeToFolderResponse>(
    `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/nodes/${encodeURIComponent(nodeId)}/parent`,
    data,
  );
}

export async function fetchCollectionContents(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
  types?: readonly ContentTypeFilter[],
): Promise<CollectionContentsResponse> {
  const params = new URLSearchParams();
  if (folderPath) params.set("folderPath", folderPath);
  if (types && types.length > 0) params.set("types", types.join(","));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const path = `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/contents${query}`;
  return apiGet<CollectionContentsResponse>(path);
}

function buildTypesQuery(types?: readonly ContentTypeFilter[]) {
  return types && types.length > 0
    ? `?types=${encodeURIComponent(types.join(","))}`
    : "";
}
