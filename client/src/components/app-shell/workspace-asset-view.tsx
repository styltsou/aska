import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useRouter, useRouterState } from "@tanstack/react-router";
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
import {
  parseWorkspaceAssetId,
  parseWorkspaceAssetPath,
  workspaceAssetPath,
} from "@/lib/workspace-asset-url";
import { readOverlayTrail } from "@/lib/workspace-overlay-history";
import { openMainAssetSearchPatch } from "@/lib/workspace-overlay-search";
import { recordRecentWorkspaceAsset } from "@/lib/workspace-recent-assets";
import type { ImageAsset } from "@/types/asset";
import {
  getAssetLocationScopeKey,
  getCurrentBoardScopeKey,
  useWorkspacePeek,
} from "./workspace-peek";
import {
  openAssetPresentation,
  syncAssetPresentationToUrl,
  type AssetPresentation,
} from "./workspace-asset-view-state";
import { useCommittedPathname } from "./use-committed-pathname";
import { useWorkspaceOverlayNavigation } from "./use-workspace-overlay-navigation";
import {
  canMorphAssetModal,
  findAssetModal,
  findVisibleAssetCard,
  startAssetModalMorph,
} from "./asset-modal-morph";

type OpenAssetOptions = {
  origin?: "canvas" | "grid";
  replace?: boolean;
  presentation?: "fullscreen";
  peekAfter?: string;
  initialData?: PeekableAssetResponse;
  imageSiblings?: CollectionImageNode[];
};

type WorkspaceAssetViewContextValue = {
  openAsset: (assetId: string, options?: OpenAssetOptions) => Promise<boolean>;
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
  const router = useRouter();
  const navigateOverlay = useWorkspaceOverlayNavigation();
  const {
    target: peekTarget,
    flushPeekImage,
    flushPeekNote,
    prepareMainNoteLeave,
  } = useWorkspacePeek();
  const location = useRouterState({ select: (state) => state.location });
  const { assetId, boardPathname } = parseWorkspaceAssetPath(location.pathname);
  const search = location.search as {
    asset?: string;
    peek?: string;
    view?: "modal" | "full";
    peekScope?: string;
    peekDescendants?: boolean;
  };
  const queryClient = useQueryClient();
  const { consumePendingDemotion, setAssetPromotionHandler } =
    useWorkspacePeek();
  const pendingPeekTransferRef = useRef<
    | {
        boardPathname: string;
        sourceIndex: number;
        closeToBoard?: boolean;
        peek?: string;
        peekScope?: string;
        peekDescendants?: boolean;
      }
    | undefined
  >(undefined);
  const pendingCloseNavigationRef = useRef<
    | {
        assetId: string;
        sourceHref: string;
        run: () => void;
      }
    | undefined
  >(undefined);
  const [presentation, setPresentation] = useState<AssetPresentation | null>(
    () =>
      assetId
        ? {
            assetId,
            open: true,
            urlStatus: "committed",
            presentation: search.view === "full" ? "fullscreen" : undefined,
          }
        : null,
  );
  const [sharedEntryAssetId, setSharedEntryAssetId] = useState<
    string | undefined
  >();
  const [morphingNoteAssetId, setMorphingNoteAssetId] = useState<
    string | undefined
  >();
  const activeMorphRef = useRef<ReturnType<typeof startAssetModalMorph> | null>(
    null,
  );
  const hiddenSourceCardRef = useRef<{
    assetId: string;
    card: HTMLElement;
    visibility: string;
  } | null>(null);
  const closingTransitionRef = useRef(false);
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;
  const locationRef = useRef(location);
  locationRef.current = location;

  const releaseHiddenSourceCard = useCallback(() => {
    const hidden = hiddenSourceCardRef.current;
    if (!hidden) return;
    hidden.card.style.visibility = hidden.visibility;
    hiddenSourceCardRef.current = null;
  }, []);

  useEffect(
    () => () => {
      activeMorphRef.current?.cancel();
      releaseHiddenSourceCard();
    },
    [releaseHiddenSourceCard],
  );

  useEffect(() => {
    if (
      hiddenSourceCardRef.current &&
      hiddenSourceCardRef.current.assetId !== presentation?.assetId
    ) {
      releaseHiddenSourceCard();
    }
  }, [presentation?.assetId, releaseHiddenSourceCard]);

  const openAssetImpl = useCallback(
    async (nextAssetId: string, options?: OpenAssetOptions) => {
      if (!parseWorkspaceAssetId(nextAssetId)) return Promise.resolve(false);
      const currentPresentation = presentationRef.current;
      if (
        assetId === nextAssetId &&
        currentPresentation?.open &&
        currentPresentation.assetId === nextAssetId
      ) {
        if (options?.presentation || search.peek === nextAssetId) {
          return navigateOverlay(
            location.pathname,
            {
              view: options?.presentation ? "full" : search.view,
              ...(search.peek === nextAssetId
                ? {
                    peek: undefined,
                    peekScope: undefined,
                    peekDescendants: undefined,
                  }
                : {}),
            },
            true,
          )
            .then(() => true)
            .catch(() => false);
        }
        return Promise.resolve(true);
      }
      if (
        peekTarget?.type === "note" &&
        peekTarget.asset.id === nextAssetId &&
        !(await flushPeekNote(nextAssetId))
      )
        return false;
      if (peekTarget?.type === "image" && peekTarget.asset.id === nextAssetId) {
        await flushPeekImage();
      }
      if (assetId && !(await prepareMainNoteLeave())) return false;
      pendingCloseNavigationRef.current = undefined;
      closingTransitionRef.current = false;
      activeMorphRef.current?.cancel();
      activeMorphRef.current = null;
      releaseHiddenSourceCard();
      setMorphingNoteAssetId(undefined);
      const queryKey = workspaceAssetQueryKey(workspaceSlug, nextAssetId);
      if (options?.initialData && !queryClient.getQueryData(queryKey)) {
        queryClient.setQueryData<PeekableAssetResponse>(
          queryKey,
          options.initialData,
        );
      }
      const nextPresentation = openAssetPresentation(
        nextAssetId,
        assetId,
        options?.imageSiblings,
        options?.presentation,
      );
      const sourceCard =
        options?.origin &&
        nextAssetId.startsWith("note-") &&
        !options.presentation &&
        !document.querySelector("[data-workspace-asset-modal]") &&
        canMorphAssetModal()
          ? findVisibleAssetCard(nextAssetId, options.origin)
          : undefined;
      if (sourceCard) {
        const sourceVisibility = sourceCard.style.visibility;
        flushSync(() => {
          setSharedEntryAssetId(nextAssetId);
          if (nextAssetId.startsWith("note-"))
            setMorphingNoteAssetId(nextAssetId);
          setPresentation(nextPresentation);
        });
        const modal = findAssetModal(nextAssetId);
        const morph = modal
          ? startAssetModalMorph("open", sourceCard, modal)
          : undefined;
        if (morph) {
          activeMorphRef.current = morph;
          hiddenSourceCardRef.current = {
            assetId: nextAssetId,
            card: sourceCard,
            visibility: sourceVisibility,
          };
          void morph.finished.then(() => {
            if (activeMorphRef.current !== morph) return;
            activeMorphRef.current = null;
            setMorphingNoteAssetId((current) =>
              current === nextAssetId ? undefined : current,
            );
          });
        } else {
          setMorphingNoteAssetId((current) =>
            current === nextAssetId ? undefined : current,
          );
        }
      }
      if (!sourceCard) {
        setSharedEntryAssetId(undefined);
        setPresentation(nextPresentation);
      }
      recordRecentWorkspaceAsset(workspaceSlug, nextAssetId);
      return navigateOverlay(
        workspaceAssetPath(boardPathname, nextAssetId),
        openMainAssetSearchPatch({
          currentPeekId: search.peek,
          nextAssetId,
          peekAfter: options?.peekAfter,
          fullscreen: options?.presentation === "fullscreen",
        }),
        options?.replace,
      )
        .then(() => true)
        .catch(() => {
          activeMorphRef.current?.cancel();
          activeMorphRef.current = null;
          releaseHiddenSourceCard();
          setSharedEntryAssetId(undefined);
          setMorphingNoteAssetId(undefined);
          setPresentation(
            assetId ? openAssetPresentation(assetId, assetId) : null,
          );
          return false;
        });
    },
    [
      assetId,
      boardPathname,
      flushPeekImage,
      flushPeekNote,
      location.pathname,
      navigateOverlay,
      peekTarget,
      prepareMainNoteLeave,
      queryClient,
      releaseHiddenSourceCard,
      search.peek,
      search.view,
      workspaceSlug,
    ],
  );
  const openAssetRef = useRef(openAssetImpl);
  useLayoutEffect(() => {
    openAssetRef.current = openAssetImpl;
  }, [openAssetImpl]);
  const openAsset = useCallback(
    (nextAssetId: string, options?: OpenAssetOptions) =>
      openAssetRef.current(nextAssetId, options),
    [],
  );

  useEffect(() => {
    setAssetPromotionHandler((assetId, options) => openAsset(assetId, options));
    return () => setAssetPromotionHandler(undefined);
  }, [openAsset, setAssetPromotionHandler]);

  useEffect(() => {
    if (assetId || !search.asset) return;
    void navigateOverlay(
      workspaceAssetPath(boardPathname, search.asset),
      { asset: undefined },
      true,
    );
  }, [assetId, boardPathname, navigateOverlay, search.asset]);

  const removeAssetFromUrl = useCallback(
    (replace = true) =>
      navigateOverlay(
        boardPathname,
        { asset: undefined, view: undefined },
        replace,
      ),
    [boardPathname, navigateOverlay],
  );

  const completeAssetClose = useCallback(() => {
    if (closingTransitionRef.current) return;
    const current = presentationRef.current;
    if (current?.open) return;
    const pending = pendingCloseNavigationRef.current;
    pendingCloseNavigationRef.current = undefined;
    setMorphingNoteAssetId(undefined);
    setSharedEntryAssetId(undefined);
    setPresentation(null);
    releaseHiddenSourceCard();
    if (
      pending &&
      (!current || pending.assetId === current.assetId) &&
      pending.sourceHref === locationRef.current.href
    ) {
      pending.run();
    }
  }, [releaseHiddenSourceCard]);

  const beginAssetClose = useCallback(
    (run: () => void) => {
      const current = presentationRef.current;
      if (!current?.open) return;
      const interruptedMorph = Boolean(activeMorphRef.current);
      activeMorphRef.current?.cancel();
      activeMorphRef.current = null;
      if (hiddenSourceCardRef.current?.assetId === current.assetId)
        hiddenSourceCardRef.current.card.style.visibility = "hidden";
      pendingCloseNavigationRef.current = {
        assetId: current.assetId,
        sourceHref: location.href,
        run,
      };
      const sourceCard =
        sharedEntryAssetId === current.assetId &&
        current.assetId.startsWith("note-") &&
        current.urlStatus === "committed" &&
        current.presentation !== "fullscreen" &&
        search.view !== "full" &&
        !interruptedMorph &&
        canMorphAssetModal()
          ? findVisibleAssetCard(current.assetId)
          : undefined;
      const modal = sourceCard ? findAssetModal(current.assetId) : undefined;
      const morph =
        sourceCard && modal
          ? startAssetModalMorph("close", sourceCard, modal)
          : undefined;
      if (morph) {
        activeMorphRef.current = morph;
        closingTransitionRef.current = true;
        void morph.finished.then(() => {
          if (activeMorphRef.current !== morph) return;
          activeMorphRef.current = null;
          flushSync(() => setPresentation(null));
          closingTransitionRef.current = false;
          completeAssetClose();
        });
        return;
      }
      setPresentation({ ...current, open: false });
    },
    [completeAssetClose, location.href, search.view, sharedEntryAssetId],
  );

  const closeAsset = useCallback(() => {
    const demotion = consumePendingDemotion();
    beginAssetClose(() => {
      const trail = readOverlayTrail(location.state);
      const distance =
        trail?.previousMainDistance ??
        trail?.boardDistance ??
        trail?.directDistance;
      if (distance && trail?.boardPathname === boardPathname) {
        if (
          demotion ||
          (!trail?.previousMainDistance && trail?.directDistance)
        ) {
          pendingPeekTransferRef.current = {
            boardPathname,
            sourceIndex: location.state.__TSR_index,
            closeToBoard:
              !trail?.previousMainDistance && Boolean(trail?.directDistance),
            ...(demotion ?? {
              peek: search.peek,
              peekScope: search.peekScope,
              peekDescendants: search.peekDescendants,
            }),
          };
        }
        router.history.go(-distance);
      } else if (demotion) {
        void navigateOverlay(
          boardPathname,
          {
            asset: undefined,
            view: undefined,
            ...demotion,
          },
          true,
        );
      } else {
        void removeAssetFromUrl(true);
      }
    });
  }, [
    beginAssetClose,
    boardPathname,
    consumePendingDemotion,
    location.state,
    navigateOverlay,
    removeAssetFromUrl,
    router.history,
    search.peek,
    search.peekDescendants,
    search.peekScope,
  ]);

  const closeAllAssets = useCallback(() => {
    beginAssetClose(() => {
      const trail = readOverlayTrail(location.state);
      const distance = trail?.boardDistance ?? trail?.directDistance;
      if (distance && trail?.boardPathname === boardPathname) {
        pendingPeekTransferRef.current = {
          boardPathname,
          sourceIndex: location.state.__TSR_index,
          closeToBoard: Boolean(trail.directDistance),
          peek: search.peek,
          peekScope: search.peekScope,
          peekDescendants: search.peekDescendants,
        };
        router.history.go(-distance);
      } else {
        void removeAssetFromUrl(true);
      }
    });
  }, [
    beginAssetClose,
    boardPathname,
    location.state,
    removeAssetFromUrl,
    router.history,
    search.peek,
    search.peekDescendants,
    search.peekScope,
  ]);

  useEffect(() => {
    const pending = pendingPeekTransferRef.current;
    if (!pending || location.state.__TSR_index === pending.sourceIndex) return;
    pendingPeekTransferRef.current = undefined;
    if (boardPathname !== pending.boardPathname) return;
    if (
      pending.closeToBoard ||
      search.peek !== pending.peek ||
      search.peekScope !== pending.peekScope ||
      search.peekDescendants !== pending.peekDescendants
    ) {
      void navigateOverlay(
        pending.closeToBoard ? boardPathname : location.pathname,
        {
          asset: undefined,
          view: pending.closeToBoard ? undefined : search.view,
          peek: pending.peek,
          peekScope: pending.peekScope,
          peekDescendants: pending.peekDescendants,
        },
        true,
      );
    }
  }, [
    boardPathname,
    location.pathname,
    location.state.__TSR_index,
    navigateOverlay,
    search.peek,
    search.peekDescendants,
    search.peekScope,
    search.view,
  ]);

  useEffect(() => {
    setPresentation((current) => {
      const synced = syncAssetPresentationToUrl(current, assetId);
      return synced && assetId
        ? {
            ...synced,
            presentation: search.view === "full" ? "fullscreen" : undefined,
          }
        : synced;
    });
  }, [assetId, search.view]);

  const value = useMemo(() => ({ openAsset }), [openAsset]);

  return (
    <WorkspaceAssetViewContext.Provider value={value}>
      {children}
      <WorkspaceAssetViewController
        workspaceSlug={workspaceSlug}
        presentation={presentation}
        sharedEntryAssetId={sharedEntryAssetId}
        morphingNoteAssetId={morphingNoteAssetId}
        openAsset={openAsset}
        closeAsset={closeAsset}
        closeAllAssets={closeAllAssets}
        completeAssetClose={completeAssetClose}
        removeAssetFromUrl={removeAssetFromUrl}
      />
    </WorkspaceAssetViewContext.Provider>
  );
}

function WorkspaceAssetViewController({
  workspaceSlug,
  presentation,
  sharedEntryAssetId,
  morphingNoteAssetId,
  openAsset,
  closeAsset,
  closeAllAssets,
  completeAssetClose,
  removeAssetFromUrl,
}: {
  workspaceSlug: string;
  presentation: AssetPresentation | null;
  sharedEntryAssetId?: string;
  morphingNoteAssetId?: string;
  openAsset: WorkspaceAssetViewContextValue["openAsset"];
  closeAsset: () => void;
  closeAllAssets: () => void;
  completeAssetClose: () => void;
  removeAssetFromUrl: (replace?: boolean) => Promise<void>;
}) {
  const assetId = presentation?.assetId;
  const pathname = useCommittedPathname();
  const overlayPathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const navigateOverlay = useWorkspaceOverlayNavigation();
  const currentSearch = useRouterState({
    select: (state) => state.location.search as { view?: "modal" | "full" },
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
  const requestedType = asset?.type ?? assetId?.split("-", 1)[0];

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
          assetModalId={assetId}
          sharedEntry={sharedEntryAssetId === assetId}
          sharedMorphing={morphingNoteAssetId === assetId}
          key={assetId}
          note={asset?.type === "note" ? asset : undefined}
          workspaceSlug={workspaceSlug}
          location={resolvedLocation}
          noteExtractionTarget={
            location ? noteExtractionTarget(location) : undefined
          }
          loading={loading}
          open={presentation.open}
          onRequestClose={closeAsset}
          onDismissAll={closeAllAssets}
          onNoteChange={(note) => {
            void queryClient.invalidateQueries({
              queryKey: workspaceAssetQueryKey(workspaceSlug, note.id),
            });
          }}
          onOpenReferencedColor={(color) => openAsset(color.id)}
          onPromote={(note) => openAsset(note.id)}
          onSwap={(note, previousNote) =>
            openAsset(note.id, { replace: true, peekAfter: previousNote.id })
          }
          onShowInBoard={showAction}
          view={currentSearch.view ?? "modal"}
          onViewChange={(view) => {
            void navigateOverlay(overlayPathname, { view }, true);
          }}
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
          location={location}
          view={currentSearch.view ?? "modal"}
          onViewChange={(view) => {
            void navigateOverlay(overlayPathname, { view }, true);
          }}
          onShowInBoard={showAction}
          onDismissAll={closeAllAssets}
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
          onDismissAll={closeAllAssets}
          view={currentSearch.view ?? "modal"}
          onViewChange={(view) => {
            void navigateOverlay(overlayPathname, { view }, true);
          }}
          onCloseComplete={completeAssetClose}
          onShowInBoard={showAction}
          onOpenImage={(image) => openAsset(image.id)}
          onEdit={() => setColorEditorOpen(true)}
        />
      ) : null}
      {requestedType === "link" ? (
        <YouTubeVideoViewer
          key={assetId}
          asset={asset?.type === "link" ? asset : undefined}
          open={presentation.open}
          loading={loading}
          initialPresentation={presentation.presentation}
          view={currentSearch.view ?? "modal"}
          onViewChange={(view) => {
            void navigateOverlay(overlayPathname, { view }, true);
          }}
          workspaceSlug={workspaceSlug}
          location={location}
          onShowInBoard={showAction}
          onClose={closeAsset}
          onDismissAll={closeAllAssets}
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
