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
  type CollectionImageNode,
  type CollectionNode,
} from "@/api/collection";
import { fetchPeekableAsset } from "@/api/collection/fetchers";
import type { PeekableAssetResponse } from "@/api/collection/types";
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
import {
  completeAssetPresentationClose,
  openAssetPresentation,
  requestAssetPresentationClose,
  syncAssetPresentationToUrl,
  type AssetPresentation,
} from "./workspace-asset-view-state";
import { useCommittedPathname } from "./use-committed-pathname";

type OpenAssetOptions = {
  replace?: boolean;
  initialData?: PeekableAssetResponse;
  imageSiblings?: CollectionImageNode[];
};

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
  const pathname = useCommittedPathname();
  const rawAssetId = useRouterState({
    select: (state) => (state.location.search as { asset?: unknown }).asset,
  });
  const assetId = parseWorkspaceAssetId(rawAssetId);
  const queryClient = useQueryClient();
  const openedInAppAssetIdsRef = useRef(new Set<string>());
  const presentationStackRef = useRef<AssetPresentation[]>([]);
  const [presentation, setPresentation] = useState<AssetPresentation | null>(
    () => (assetId ? { assetId, open: true, urlStatus: "committed" } : null),
  );
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;

  const openAsset = useCallback(
    (nextAssetId: string, options?: OpenAssetOptions) => {
      if (!parseWorkspaceAssetId(nextAssetId)) return;
      const currentPresentation = presentationRef.current;
      if (
        !options?.replace &&
        currentPresentation?.open &&
        currentPresentation.assetId !== nextAssetId
      ) {
        presentationStackRef.current.push(currentPresentation);
      }
      const queryKey = workspaceAssetQueryKey(workspaceSlug, nextAssetId);
      if (options?.initialData) {
        queryClient.setQueryData<PeekableAssetResponse>(
          queryKey,
          (current) => current ?? options.initialData,
        );
        void queryClient.invalidateQueries({
          queryKey,
          exact: true,
          refetchType: "none",
        });
      }
      setPresentation(
        openAssetPresentation(nextAssetId, assetId, options?.imageSiblings),
      );
      openedInAppAssetIdsRef.current.add(nextAssetId);
      recordRecentWorkspaceAsset(workspaceSlug, nextAssetId);
      void navigate({
        // The workspace route owns the validated search schema, but using it as
        // an implicit destination would collapse nested routes to its index.
        to: pathname as "/$workspaceSlug",
        search: (previous) => ({ ...previous, asset: nextAssetId }),
        replace: options?.replace,
      }).catch(() => {
        openedInAppAssetIdsRef.current.delete(nextAssetId);
        setPresentation(
          assetId ? openAssetPresentation(assetId, assetId) : null,
        );
      });
    },
    [assetId, navigate, pathname, queryClient, workspaceSlug],
  );

  const removeAssetFromUrl = useCallback(
    (replace = true) =>
      navigate({
        to: pathname as "/$workspaceSlug",
        search: (previous) => {
          const { asset: _asset, ...rest } = previous;
          return rest;
        },
        replace,
      }),
    [navigate, pathname],
  );

  const closeAsset = useCallback(() => {
    setPresentation(requestAssetPresentationClose);
  }, []);

  const completeAssetClose = useCallback(() => {
    const current = presentationRef.current;
    const completed = completeAssetPresentationClose(current);
    setPresentation(completed.presentation);
    if (!completed.shouldCleanupUrl || !current) return;

    const openedHere = openedInAppAssetIdsRef.current.delete(current.assetId);
    if (openedHere && window.history.length > 1) {
      const previousPresentation = presentationStackRef.current.pop();
      if (previousPresentation) {
        setPresentation(
          openAssetPresentation(
            previousPresentation.assetId,
            undefined,
            previousPresentation.imageSiblings,
          ),
        );
      }
      window.history.back();
      return;
    }
    void removeAssetFromUrl(true);
  }, [removeAssetFromUrl]);

  useEffect(() => {
    const current = presentationRef.current;
    if (assetId && current && current.assetId !== assetId) {
      const previous = presentationStackRef.current.at(-1);
      if (previous?.assetId === assetId) presentationStackRef.current.pop();
      else presentationStackRef.current.length = 0;
    }
    setPresentation((current) => syncAssetPresentationToUrl(current, assetId));
    if (!assetId) {
      openedInAppAssetIdsRef.current.clear();
      presentationStackRef.current.length = 0;
    }
  }, [assetId]);

  const value = useMemo(
    () => ({ assetId: presentation?.assetId, openAsset, closeAsset }),
    [closeAsset, openAsset, presentation?.assetId],
  );

  return (
    <WorkspaceAssetViewContext.Provider value={value}>
      {children}
      <WorkspaceAssetViewController
        workspaceSlug={workspaceSlug}
        presentation={presentation}
        openAsset={openAsset}
        closeAsset={closeAsset}
        completeAssetClose={completeAssetClose}
        removeAssetFromUrl={removeAssetFromUrl}
      />
    </WorkspaceAssetViewContext.Provider>
  );
}

function WorkspaceAssetViewController({
  workspaceSlug,
  presentation,
  openAsset,
  closeAsset,
  completeAssetClose,
  removeAssetFromUrl,
}: {
  workspaceSlug: string;
  presentation: AssetPresentation | null;
  openAsset: WorkspaceAssetViewContextValue["openAsset"];
  closeAsset: () => void;
  completeAssetClose: () => void;
  removeAssetFromUrl: (replace?: boolean) => Promise<void>;
}) {
  const assetId = presentation?.assetId;
  const pathname = useCommittedPathname();
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
    if (!assetId || !assetQuery.isError || assetQuery.data) return;
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
    closeAsset();
  }, [
    assetId,
    assetQuery.data,
    assetQuery.error,
    assetQuery.isError,
    closeAsset,
  ]);

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
    closeAsset();
  }, [asset, assetId, closeAsset]);

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
  const queriedSiblingNodes =
    location?.type === "collection"
      ? collectionSiblingQuery.data?.nodes
      : inboxSiblingQuery.data?.nodes;
  const siblingNodes = queriedSiblingNodes ?? presentation?.imageSiblings;
  const siblingImageNodes = useMemo(
    () =>
      (siblingNodes ?? []).filter(
        (
          node: CollectionNode,
        ): node is Extract<CollectionNode, { type: "image" }> =>
          node.type === "image",
      ),
    [siblingNodes],
  );
  const siblingImages = useMemo(
    () =>
      siblingImageNodes
        .map(collectionNodeToAsset)
        .filter(
          (candidate): candidate is ImageAsset => candidate.type === "image",
        ),
    [siblingImageNodes],
  );

  if (!assetId || !presentation) return null;

  const requestedType = asset?.type ?? assetId.split("-", 1)[0];
  const loading =
    !asset ||
    !location ||
    (requestedType === "link" && asset.type === "link" && !asset.video);
  const resolvedLocation = location ?? ({ type: "inbox" } as const);

  const showAction = canShowInBoard ? showInBoard : undefined;
  const collectionPath =
    location?.type === "collection"
      ? [location.collectionSlug, location.folderPath].filter(Boolean).join("/")
      : undefined;
  const viewerAssets =
    siblingImages.length > 0
      ? siblingImages
      : asset?.type === "image"
        ? [asset]
        : [];

  return (
    <>
      {requestedType === "note" ? (
        <NoteDetailDrawer
          note={asset?.type === "note" ? asset : undefined}
          workspaceSlug={workspaceSlug}
          location={resolvedLocation}
          noteExtractionTarget={
            location ? noteExtractionTarget(location) : undefined
          }
          loading={loading}
          open={presentation.open}
          onRequestClose={closeAsset}
          onNoteChange={(note) => {
            void queryClient.invalidateQueries({
              queryKey: workspaceAssetQueryKey(workspaceSlug, note.id),
            });
          }}
          onOpenReferencedColor={(color) => openAsset(color.id)}
          onPromote={(note) => openAsset(note.id)}
          onSwap={(note) => openAsset(note.id, { replace: true })}
          onShowInBoard={showAction}
          onClose={completeAssetClose}
        />
      ) : null}
      {requestedType === "image" ? (
        <ImageAssetViewer
          asset={asset?.type === "image" ? asset : undefined}
          assets={viewerAssets}
          open={presentation.open}
          loading={loading}
          workspaceSlug={workspaceSlug}
          onShowInBoard={showAction}
          onAssetChange={(image) => {
            const node = siblingImageNodes.find(
              (candidate) => candidate.id === image.id,
            );
            openAsset(image.id, {
              replace: true,
              initialData:
                node?.type === "image" && location
                  ? { asset: node, location }
                  : undefined,
              imageSiblings: siblingImageNodes,
            });
          }}
          onOpenChange={(open) => {
            if (!open) closeAsset();
          }}
          onOpenChangeComplete={(open) => {
            if (!open) completeAssetClose();
          }}
        />
      ) : null}
      {requestedType === "color" ? (
        <ColorDetailDrawer
          color={asset?.type === "color" ? asset : undefined}
          open={presentation.open}
          loading={loading}
          workspaceSlug={workspaceSlug}
          scope={colorSearchScope(resolvedLocation)}
          onClose={closeAsset}
          onCloseComplete={completeAssetClose}
          onShowInBoard={showAction}
          onOpenImage={(image) => openAsset(image.id)}
          onEdit={() => setColorEditorOpen(true)}
        />
      ) : null}
      {requestedType === "link" ? (
        <YouTubeVideoViewer
          asset={asset?.type === "link" ? asset : undefined}
          open={presentation.open}
          loading={loading}
          workspaceSlug={workspaceSlug}
          onShowInBoard={showAction}
          onClose={closeAsset}
          onCloseComplete={completeAssetClose}
        />
      ) : null}
      {asset?.type === "color" && location ? (
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
