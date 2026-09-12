import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  collectionContentsQueryOptions,
  inboxContentsQueryOptions,
  type AssetLocation,
  type CollectionNode,
} from "@/api/collection";
import { fetchPeekableAsset } from "@/api/collection/fetchers";
import { ColorDetailDrawer } from "@/components/board/color-detail-drawer";
import { NoteDetailDrawer } from "@/components/board/note-detail-drawer";
import { ImageAssetViewer } from "@/components/board/image-asset-viewer";
import { YouTubeVideoViewer } from "@/components/board/youtube-video-viewer";
import { ColorEditorDialog } from "@/components/app-shell/color-editor-dialog";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { ApiError, getUserFacingApiErrorMessage } from "@/lib/api";
import { parseWorkspaceAssetId } from "@/lib/workspace-asset-url";
import { recordRecentWorkspaceAsset } from "@/lib/workspace-recent-assets";
import type { ImageAsset } from "@/types/asset";
import {
  getAssetLocationScopeKey,
  getCurrentBoardScopeKey,
  useWorkspacePeek,
} from "./workspace-peek";

type OpenAssetOptions = { replace?: boolean };

type WorkspaceAssetViewContextValue = {
  assetId?: string;
  openAsset: (assetId: string, options?: OpenAssetOptions) => void;
  closeAsset: () => void;
};

const WorkspaceAssetViewContext =
  createContext<WorkspaceAssetViewContextValue | null>(null);

export const workspaceAssetQueryKey = (
  workspaceSlug: string,
  assetId: string,
) => ["workspace-asset", workspaceSlug, assetId] as const;

export function useWorkspaceAssetView() {
  const value = useContext(WorkspaceAssetViewContext);
  if (!value) {
    throw new Error(
      "useWorkspaceAssetView must be used inside WorkspaceAssetViewProvider",
    );
  }
  return value;
}

export function WorkspaceAssetViewProvider({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: ReactNode;
}) {
  const navigate = useNavigate({ from: "/$workspaceSlug" });
  const rawAssetId = useRouterState({
    select: (state) => (state.location.search as { asset?: unknown }).asset,
  });
  const assetId = parseWorkspaceAssetId(rawAssetId);
  const openedInAppAssetIdsRef = useRef(new Set<string>());

  const openAsset = useCallback(
    (nextAssetId: string, options?: OpenAssetOptions) => {
      if (!parseWorkspaceAssetId(nextAssetId)) return;
      openedInAppAssetIdsRef.current.add(nextAssetId);
      recordRecentWorkspaceAsset(workspaceSlug, nextAssetId);
      void navigate({
        search: (previous) => ({ ...previous, asset: nextAssetId }),
        replace: options?.replace,
      });
    },
    [navigate, workspaceSlug],
  );

  const removeAssetFromUrl = useCallback(
    (replace = true) =>
      navigate({
        search: (previous) => {
          const { asset: _asset, ...rest } = previous;
          return rest;
        },
        replace,
      }),
    [navigate],
  );

  const closeAsset = useCallback(() => {
    const openedHere = assetId
      ? openedInAppAssetIdsRef.current.delete(assetId)
      : false;

    if (openedHere && window.history.length > 1) {
      window.history.back();
      return;
    }
    void removeAssetFromUrl(true);
  }, [assetId, removeAssetFromUrl]);

  useEffect(() => {
    if (!assetId) openedInAppAssetIdsRef.current.clear();
  }, [assetId]);

  const value = useMemo(
    () => ({ assetId, openAsset, closeAsset }),
    [assetId, closeAsset, openAsset],
  );

  return (
    <WorkspaceAssetViewContext.Provider value={value}>
      {children}
      <WorkspaceAssetViewController
        workspaceSlug={workspaceSlug}
        assetId={assetId}
        openAsset={openAsset}
        closeAsset={closeAsset}
        removeAssetFromUrl={removeAssetFromUrl}
      />
    </WorkspaceAssetViewContext.Provider>
  );
}

function WorkspaceAssetViewController({
  workspaceSlug,
  assetId,
  openAsset,
  closeAsset,
  removeAssetFromUrl,
}: {
  workspaceSlug: string;
  assetId?: string;
  openAsset: WorkspaceAssetViewContextValue["openAsset"];
  closeAsset: () => void;
  removeAssetFromUrl: (replace?: boolean) => Promise<void>;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const queryClient = useQueryClient();
  const { showAssetInBoard } = useWorkspacePeek();
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const unavailableAssetRef = useRef<string | undefined>(undefined);
  const assetQuery = useQuery({
    queryKey: workspaceAssetQueryKey(workspaceSlug, assetId ?? ""),
    queryFn: ({ signal }) =>
      fetchPeekableAsset(workspaceSlug, assetId!, signal),
    enabled: Boolean(assetId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!assetId) unavailableAssetRef.current = undefined;
  }, [assetId]);

  useEffect(() => {
    if (!assetId || !assetQuery.isError) return;
    if (unavailableAssetRef.current === assetId) return;
    unavailableAssetRef.current = assetId;
    const message =
      assetQuery.error instanceof ApiError && assetQuery.error.status === 404
        ? "This asset is no longer available."
        : getUserFacingApiErrorMessage(
            assetQuery.error,
            "Could not open this asset.",
          );
    toast.error(message);
    void removeAssetFromUrl(true);
  }, [assetId, assetQuery.error, assetQuery.isError, removeAssetFromUrl]);

  const response = assetQuery.data;
  const asset = useMemo(
    () => (response ? collectionNodeToAsset(response.asset) : undefined),
    [response],
  );

  useEffect(() => {
    if (!assetId || asset?.type !== "link" || asset.video) return;
    if (unavailableAssetRef.current === assetId) return;
    unavailableAssetRef.current = assetId;
    toast.info("Regular links open in a new tab.");
    void removeAssetFromUrl(true);
  }, [asset, assetId, removeAssetFromUrl]);

  const location = response?.location;
  const destinationScope = location
    ? getAssetLocationScopeKey(workspaceSlug, location)
    : undefined;
  const currentScope = getCurrentBoardScopeKey(pathname);
  const canShowInBoard = Boolean(
    asset && location && destinationScope !== currentScope,
  );
  const showInBoard = useCallback(async () => {
    if (!asset || !location) return;
    await removeAssetFromUrl(true);
    await showAssetInBoard(asset.id, location);
  }, [asset, location, removeAssetFromUrl, showAssetInBoard]);

  const inboxSiblingQuery = useQuery({
    ...inboxContentsQueryOptions(workspaceSlug),
    enabled: asset?.type === "image" && location?.type === "inbox",
  });
  const collectionSiblingQuery = useQuery({
    ...collectionContentsQueryOptions(
      workspaceSlug,
      location?.type === "collection" ? location.collectionSlug : "",
      location?.type === "collection" ? location.folderPath : undefined,
    ),
    enabled: asset?.type === "image" && location?.type === "collection",
  });
  const siblingNodes =
    location?.type === "collection"
      ? collectionSiblingQuery.data?.nodes
      : inboxSiblingQuery.data?.nodes;
  const siblingImages = useMemo(
    () =>
      (siblingNodes ?? [])
        .filter(
          (
            node: CollectionNode,
          ): node is Extract<CollectionNode, { type: "image" }> =>
            node.type === "image",
        )
        .map(collectionNodeToAsset)
        .filter(
          (candidate): candidate is ImageAsset => candidate.type === "image",
        ),
    [siblingNodes],
  );

  if (!asset || !location) return null;

  const showAction = canShowInBoard ? showInBoard : undefined;
  const collectionPath =
    location.type === "collection"
      ? [location.collectionSlug, location.folderPath].filter(Boolean).join("/")
      : undefined;

  return (
    <>
      {asset.type === "note" ? (
        <NoteDetailDrawer
          note={asset}
          workspaceSlug={workspaceSlug}
          location={location}
          noteExtractionTarget={noteExtractionTarget(location)}
          onNoteChange={(note) => {
            void queryClient.invalidateQueries({
              queryKey: workspaceAssetQueryKey(workspaceSlug, note.id),
            });
          }}
          onOpenReferencedColor={(color) => openAsset(color.id)}
          onPromote={(note) => openAsset(note.id)}
          onSwap={(note) => openAsset(note.id, { replace: true })}
          onShowInBoard={showAction}
          onClose={closeAsset}
        />
      ) : null}
      {asset.type === "image" ? (
        <ImageAssetViewer
          asset={asset}
          assets={siblingImages.length > 0 ? siblingImages : [asset]}
          open
          workspaceSlug={workspaceSlug}
          onShowInBoard={showAction}
          onAssetChange={(image) => openAsset(image.id, { replace: true })}
          onOpenChange={(open) => {
            if (!open) closeAsset();
          }}
        />
      ) : null}
      {asset.type === "color" ? (
        <ColorDetailDrawer
          color={asset}
          open
          workspaceSlug={workspaceSlug}
          scope={colorSearchScope(location)}
          onClose={closeAsset}
          onShowInBoard={showAction}
          onOpenImage={(image) => openAsset(image.id)}
          onEdit={() => setColorEditorOpen(true)}
        />
      ) : null}
      {asset.type === "link" && asset.video ? (
        <YouTubeVideoViewer
          asset={asset}
          workspaceSlug={workspaceSlug}
          onShowInBoard={showAction}
          onClose={closeAsset}
        />
      ) : null}
      {asset.type === "color" ? (
        <ColorEditorDialog
          workspaceSlug={workspaceSlug}
          target={location.type === "inbox" ? "inbox" : "collection"}
          collectionPath={collectionPath}
          color={asset}
          open={colorEditorOpen}
          onOpenChange={(open) => {
            setColorEditorOpen(open);
            if (!open) {
              void queryClient.invalidateQueries({
                queryKey: workspaceAssetQueryKey(workspaceSlug, asset.id),
              });
            }
          }}
        />
      ) : null}
    </>
  );
}

function noteExtractionTarget(location: AssetLocation) {
  return location.type === "inbox"
    ? ({ target: "inbox" as const } as const)
    : ({
        collectionSlug: location.collectionSlug,
        parentFolderPath: location.folderPath,
      } as const);
}

function colorSearchScope(location: AssetLocation) {
  return location.type === "inbox"
    ? ({ type: "inbox" as const } as const)
    : ({
        type: "collection" as const,
        collectionSlug: location.collectionSlug,
        folderPath: location.folderPath,
        includeDescendants: false,
      } as const);
}
