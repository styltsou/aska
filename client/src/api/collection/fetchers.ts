import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type {
  CollectionContentsResponse,
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
): Promise<InboxContentsResponse> {
  return apiGet<InboxContentsResponse>(
    `/api/v1/workspace/${workspaceSlug}/inbox`,
  );
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

export async function fetchCollectionContents(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
): Promise<CollectionContentsResponse> {
  let path = `/api/v1/workspace/${workspaceSlug}/collections/${collectionSlug}/contents`;
  if (folderPath) {
    path += `?folderPath=${encodeURIComponent(folderPath)}`;
  }
  return apiGet<CollectionContentsResponse>(path);
}
