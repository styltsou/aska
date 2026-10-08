import "@/components/board/note-workspace.css";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftRightIcon,
  LocateFixedIcon,
  Maximize2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import { NoteHighlightControl } from "@/components/board/note-highlight-control";
import { NoteSaveStatus } from "@/components/board/note-save-status";
import { AssetTimestampCard } from "@/components/board/asset-timestamp-card";
import { NoteTitleField } from "@/components/board/note-title-field";
import { NoteRichText } from "@/components/board/note-rich-text";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDeleteAsset,
  useUpdateNote,
  type AssetLocation,
} from "@/api/collection";
import { fetchPeekableAsset } from "@/api/collection/fetchers";
import type { NoteMentionTarget } from "@/api/note-mentions/types";
import { resolveGradientCss } from "@/lib/color-gradient";
import { colorAssetToSearchColors } from "@/lib/color-asset-search";
import { parseFrontMatter } from "@/lib/front-matter";
import {
  clearEditDraft,
  clearDeletedNoteDrafts,
  getNoteSaveErrorMessage,
  loadEditDraft,
  loadLegacyEditDraft,
  pruneRedundantEditDrafts,
  saveEditDraft,
} from "@/lib/note-edit-draft";
import {
  matchesKeybinding,
  OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT,
} from "@/lib/keybindings";
import { composeCopiedNoteMarkdown } from "@/lib/note-copy";
import { getPlatformAlt, getPlatformShift } from "@/lib/platform";
import { useWeightedColorImageSearch } from "@/api/color-search";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";
import { useBlocker, useRouterState } from "@tanstack/react-router";
import { LinkResolutionPoller } from "@/api/url-unfurl/link-resolution-poller";
import { YouTubeVideoContent } from "@/components/board/youtube-video-viewer";
import {
  ImagePeek,
  ImagePeekHeaderActions,
} from "@/components/board/image-asset-viewer/image-peek";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  ColorAsset,
  ImageAsset,
  LinkAsset,
  NoteAsset,
} from "@/types/asset";
import type { NoteHighlightColor } from "@/lib/note-highlights";
import {
  SIDE_PANEL_ANIMATE,
  SIDE_PANEL_EXIT,
  SIDE_PANEL_INITIAL,
  SIDE_PANEL_TRANSITION,
} from "./side-panel-motion";
import { getSidebarCollectionLocation } from "./sidebar-collection-navigation";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import {
  parseWorkspaceAssetId,
  parseWorkspaceAssetPath,
} from "@/lib/workspace-asset-url";
import { useWorkspaceOverlayNavigation } from "./use-workspace-overlay-navigation";

export type PeekColorScope =
  | { type: "inbox" }
  | {
      type: "collection";
      collectionSlug: string;
      folderPath?: string;
      includeDescendants: boolean;
    };

type PeekTarget =
  | { type: "note"; asset: NoteAsset; location?: AssetLocation }
  | { type: "image"; asset: ImageAsset; location?: AssetLocation }
  | {
      type: "link";
      asset: LinkAsset & { video: NonNullable<LinkAsset["video"]> };
      location?: AssetLocation;
    }
  | {
      type: "color";
      asset: ColorAsset;
      scope: PeekColorScope;
      location?: AssetLocation;
    };

export type BoardShowRequest = {
  id: number;
  assetId: string;
  scopeKey: string;
};

export function getAssetLocationScopeKey(
  workspaceSlug: string,
  location: AssetLocation,
): string {
  if (location.type === "inbox") return `inbox:${workspaceSlug}`;
  return `collection:${workspaceSlug}/${[
    location.collectionSlug,
    location.folderPath,
  ]
    .filter(Boolean)
    .join("/")}`;
}

export function getCurrentBoardScopeKey(pathname: string): string | undefined {
  pathname = parseWorkspaceAssetPath(pathname).boardPathname;
  const location = getSidebarCollectionLocation(pathname);
  if (pathname === `/${location.workspaceSlug}/inbox`) {
    return `inbox:${location.workspaceSlug}`;
  }
  if (!location.collectionSlug) return undefined;
  return getAssetLocationScopeKey(location.workspaceSlug, {
    type: "collection",
    collectionSlug: location.collectionSlug,
    folderPath: location.folderPath,
  });
}

function getLocationFromColorScope(scope: PeekColorScope): AssetLocation {
  return scope.type === "inbox"
    ? { type: "inbox" }
    : {
        type: "collection",
        collectionSlug: scope.collectionSlug,
        folderPath: scope.folderPath,
      };
}

function encodeColorScope(scope: PeekColorScope): string {
  return scope.type === "inbox"
    ? "inbox"
    : `collection:${[scope.collectionSlug, scope.folderPath].filter(Boolean).join("/")}`;
}

function colorScopeFromUrl(
  value: string | undefined,
  includeDescendants: boolean | undefined,
  location: AssetLocation,
): PeekColorScope {
  if (value === "inbox") return { type: "inbox" };
  if (value?.startsWith("collection:")) {
    const [collectionSlug, ...folders] = value
      .slice("collection:".length)
      .split("/");
    if (collectionSlug) {
      return {
        type: "collection",
        collectionSlug,
        folderPath: folders.join("/") || undefined,
        includeDescendants: Boolean(includeDescendants),
      };
    }
  }
  return location.type === "inbox"
    ? { type: "inbox" }
    : { ...location, includeDescendants: false };
}

type WorkspacePeekContextValue = {
  target?: PeekTarget;
  showRequest?: BoardShowRequest;
  activeNoteId?: string;
  isResizing: boolean;
  peekNote: (
    note: NoteAsset,
    location: AssetLocation,
    options?: PeekOpenOptions,
  ) => Promise<boolean>;
  peekImage: (
    image: ImageAsset,
    location: AssetLocation,
    options?: PeekOpenOptions,
  ) => Promise<boolean>;
  peekColor: (
    color: ColorAsset,
    scope: PeekColorScope,
    options?: PeekOpenOptions,
  ) => Promise<boolean>;
  peekVideo: (
    video: LinkAsset,
    location?: AssetLocation,
    options?: PeekOpenOptions,
  ) => Promise<boolean>;
  consumePendingDemotion: () => PeekUrlState | undefined;
  syncPeekVideoNote: (assetId: string, note: string | null) => void;
  setActiveNoteId: (noteId?: string) => void;
  syncPeekNote: (note: NoteAsset) => void;
  syncPeekImage: (image: ImageAsset) => void;
  setNotePromotionHandler: (
    handler?: (note: NoteAsset) => Promise<boolean>,
  ) => void;
  setMainNoteLeaveHandler: (handler?: () => Promise<boolean>) => void;
  prepareMainNoteLeave: () => Promise<boolean>;
  setPeekNoteFlushHandler: (
    handler?: (noteId: string, mode?: "close") => Promise<NoteAsset | false>,
  ) => void;
  flushPeekNote: (noteId: string) => Promise<NoteAsset | false>;
  setPeekImageFlushHandler: (handler?: () => Promise<void>) => void;
  flushPeekImage: () => Promise<void>;
  promotePeekedAsset: () => Promise<void>;
  setAssetPromotionHandler: (
    handler?: (
      assetId: string,
      options?: { presentation: "fullscreen" },
    ) => Promise<boolean>,
  ) => void;
  showPeekedAsset: () => Promise<void>;
  showAssetInBoard: (assetId: string, location: AssetLocation) => Promise<void>;
  consumeShowRequest: (requestId: number) => void;
  setNoteSwapHandler: (handler?: () => Promise<void>) => void;
  swapNotes: () => Promise<void>;
  closePeek: () => void;
};

type PeekOpenOptions = { demoteMain?: boolean; skipNavigation?: boolean };
export type PeekUrlState = {
  peek: string;
  peekScope?: string;
  peekDescendants?: boolean;
};

const WorkspacePeekContext = createContext<WorkspacePeekContextValue | null>(
  null,
);
const PEEK_MIN_WIDTH = 720;
const PEEK_WIDTH = 960;

function getPeekWidthBounds() {
  const viewportMax =
    typeof window === "undefined" ? PEEK_WIDTH : window.innerWidth * 0.5;
  const max = viewportMax;
  const min = Math.min(PEEK_MIN_WIDTH, max);
  return { min, max, defaultWidth: Math.min(PEEK_WIDTH, max) };
}
const storageKey = (workspaceSlug: string) =>
  `aska.workspace-peek:v1:${workspaceSlug}`;
const widthStorageKey = (workspaceSlug: string) =>
  `aska.workspace-peek-width:v1:${workspaceSlug}`;

function clampPeekWidth(width: number) {
  const { min, max } = getPeekWidthBounds();
  return Math.min(Math.max(width, min), max);
}

function readPeekWidth(workspaceSlug: string) {
  const { defaultWidth } = getPeekWidthBounds();
  if (typeof window === "undefined") return defaultWidth;

  try {
    const storedValue = localStorage.getItem(widthStorageKey(workspaceSlug));
    if (storedValue === null) return defaultWidth;
    const storedWidth = Number(storedValue);
    if (Number.isFinite(storedWidth)) return clampPeekWidth(storedWidth);
  } catch {}

  return defaultWidth;
}

function persistPeekWidth(workspaceSlug: string, width: number) {
  try {
    localStorage.setItem(widthStorageKey(workspaceSlug), String(width));
  } catch {}
}

export function useWorkspacePeek() {
  const value = useContext(WorkspacePeekContext);
  if (!value)
    throw new Error(
      "useWorkspacePeek must be used inside WorkspacePeekProvider",
    );
  return value;
}

export function WorkspacePeekProvider({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const navigateOverlay = useWorkspaceOverlayNavigation();
  const routeLocation = useRouterState({ select: (state) => state.location });
  const pathname = parseWorkspaceAssetPath(
    routeLocation.pathname,
  ).boardPathname;
  const peekSearch = routeLocation.search as {
    peek?: string;
    peekScope?: string;
    peekDescendants?: boolean;
  };
  const peekId = parseWorkspaceAssetId(peekSearch.peek);
  const [target, setTarget] = useState<PeekTarget | undefined>();
  const [peekError, setPeekError] = useState(false);
  const [peekRetry, setPeekRetry] = useState(0);
  const [showRequest, setShowRequest] = useState<BoardShowRequest>();
  const [isRailReserved, setIsRailReserved] = useState(() => Boolean(peekId));
  const [activeNoteId, setActiveNoteId] = useState<string>();
  const [isResizing, setIsResizing] = useState(false);
  const [peekFocusRequest, setPeekFocusRequest] = useState(0);
  const [width, setWidth] = useState(() => readPeekWidth(workspaceSlug));
  const widthRef = useRef(width);
  const targetRef = useRef(target);
  const pendingDemotionRef = useRef<PeekUrlState | undefined>(undefined);
  const targetCacheRef = useRef(new Map<string, PeekTarget>());
  const migratedWorkspaceRef = useRef<string | undefined>(undefined);
  const showRequestIdRef = useRef(0);
  const notePromotionHandlerRef = useRef<
    ((note: NoteAsset) => Promise<boolean>) | undefined
  >(undefined);
  const mainNoteLeaveHandlerRef = useRef<(() => Promise<boolean>) | undefined>(
    undefined,
  );
  const assetPromotionHandlerRef = useRef<
    | ((
        assetId: string,
        options?: { presentation: "fullscreen" },
      ) => Promise<boolean>)
    | undefined
  >(undefined);
  const noteSwapHandlerRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );
  const peekNoteFlushHandlerRef = useRef<
    ((noteId: string, mode?: "close") => Promise<NoteAsset | false>) | undefined
  >(undefined);
  const peekImageFlushHandlerRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );
  const peekSwitchSequenceRef = useRef(0);
  const resizeEndTimeoutRef = useRef<number | undefined>(undefined);
  widthRef.current = width;
  targetRef.current = target;

  const switchPeekTarget = useCallback(
    async (nextId: string, apply: () => void, skipFlush = false) => {
      const sequence = ++peekSwitchSequenceRef.current;
      const current = targetRef.current;
      const flushCurrent = peekNoteFlushHandlerRef.current;
      if (
        !skipFlush &&
        current?.type === "note" &&
        current.asset.id !== nextId
      ) {
        if (!flushCurrent) return false;
        const saved = await flushCurrent(current.asset.id);
        if (!saved || sequence !== peekSwitchSequenceRef.current) return false;
      }
      if (
        !skipFlush &&
        current?.type === "image" &&
        current.asset.id !== nextId
      ) {
        await peekImageFlushHandlerRef.current?.();
        if (sequence !== peekSwitchSequenceRef.current) return false;
      }
      apply();
      return true;
    },
    [],
  );

  useEffect(() => {
    peekSwitchSequenceRef.current += 1;
  }, [peekId, workspaceSlug]);

  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      const currentNote = targetRef.current;
      if (currentNote?.type !== "note") return false;
      const currentMainId = parseWorkspaceAssetPath(current.pathname).assetId;
      const nextMainId = parseWorkspaceAssetPath(next.pathname).assetId;
      const currentPeekId = (current.search as { peek?: string }).peek;
      const nextPeekId = (next.search as { peek?: string }).peek;
      if (
        nextMainId !== currentNote.asset.id &&
        (currentPeekId !== currentNote.asset.id || nextPeekId === currentPeekId)
      )
        return false;
      if (
        currentMainId === currentNote.asset.id &&
        currentPeekId === nextPeekId
      )
        return false;
      const saved = await peekNoteFlushHandlerRef.current?.(
        currentNote.asset.id,
        currentPeekId === currentNote.asset.id &&
          nextPeekId === undefined &&
          nextMainId !== currentNote.asset.id
          ? "close"
          : undefined,
      );
      return !saved;
    },
    enableBeforeUnload: false,
  });

  useEffect(() => {
    setPeekFocusRequest(0);
    setPeekError(false);
    setShowRequest(undefined);
    setTarget(undefined);
    targetCacheRef.current.clear();
    setIsRailReserved(false);
    setWidth(readPeekWidth(workspaceSlug));
  }, [workspaceSlug]);

  useEffect(() => {
    if (!peekId) {
      setTarget(undefined);
      setPeekError(false);
      return;
    }
    setPeekError(false);
    if (targetRef.current?.asset.id !== peekId) {
      setTarget(targetCacheRef.current.get(peekId));
    }
    setIsRailReserved(true);
  }, [peekId]);

  useEffect(() => {
    if (migratedWorkspaceRef.current === workspaceSlug) return;
    migratedWorkspaceRef.current = workspaceSlug;
    const stored = readTarget(workspaceSlug);
    try {
      sessionStorage.removeItem(storageKey(workspaceSlug));
    } catch {}
    if (!peekId && stored?.asset.id && parseWorkspaceAssetId(stored.asset.id)) {
      void navigateOverlay(
        routeLocation.pathname,
        {
          peek: stored.asset.id,
          ...(stored.type === "color"
            ? {
                peekScope: encodeColorScope(stored.scope),
                peekDescendants:
                  (stored.scope.type === "collection" &&
                    stored.scope.includeDescendants) ||
                  undefined,
              }
            : {}),
        },
        true,
      );
    }
  }, [navigateOverlay, peekId, routeLocation.pathname, workspaceSlug]);

  useEffect(() => {
    if (!peekId) return;
    let active = true;
    void fetchPeekableAsset(workspaceSlug, peekId)
      .then(({ asset, location }) => {
        if (!active) return;
        const videoAsset =
          asset.type === "link" ? collectionNodeToAsset(asset) : undefined;
        let resolved: PeekTarget | undefined;
        if (asset.type === "note") resolved = { type: "note", asset, location };
        else if (asset.type === "image") {
          const imageAsset = collectionNodeToAsset(asset);
          if (imageAsset.type === "image") {
            resolved = { type: "image", asset: imageAsset, location };
          }
        } else if (asset.type === "color")
          resolved = {
            type: "color",
            asset,
            scope: colorScopeFromUrl(
              peekSearch.peekScope,
              peekSearch.peekDescendants,
              location,
            ),
            location,
          };
        else if (videoAsset?.type === "link" && videoAsset.video)
          resolved = {
            type: "link",
            asset: { ...videoAsset, video: videoAsset.video },
            location,
          };
        if (resolved) {
          setTarget((current) => {
            const next =
              current?.type === "note" &&
              resolved.type === "note" &&
              current.asset.id === resolved.asset.id &&
              current.asset.updatedAt &&
              resolved.asset.updatedAt &&
              current.asset.updatedAt >= resolved.asset.updatedAt
                ? current
                : current?.type === "image" &&
                    resolved.type === "image" &&
                    current.asset.id === resolved.asset.id &&
                    current.asset.updatedAt &&
                    resolved.asset.updatedAt &&
                    current.asset.updatedAt >= resolved.asset.updatedAt
                  ? current
                  : resolved;
            targetCacheRef.current.set(peekId, next);
            return next;
          });
        } else {
          targetCacheRef.current.delete(peekId);
          setTarget((current) =>
            current?.asset.id === peekId ? undefined : current,
          );
          setPeekError(true);
        }
      })
      .catch((error) => {
        if (!active) return;
        targetCacheRef.current.delete(peekId);
        setTarget((current) =>
          current?.asset.id === peekId ? undefined : current,
        );
        setPeekError(true);
        toast.error(
          getUserFacingApiErrorMessage(error, "Could not open this peek."),
        );
      });
    return () => {
      active = false;
    };
  }, [
    peekId,
    peekRetry,
    peekSearch.peekScope,
    peekSearch.peekDescendants,
    workspaceSlug,
  ]);
  useIsomorphicLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--workspace-peek-rail-width",
      isRailReserved ? `${width}px` : "0px",
    );
    document.documentElement.style.setProperty(
      "--workspace-peek-panel-width",
      `${width}px`,
    );
    document.documentElement.style.setProperty(
      "--workspace-peek-stage-gap",
      isRailReserved ? "var(--app-shell-inset)" : "0px",
    );
    return () => {
      document.documentElement.style.removeProperty(
        "--workspace-peek-rail-width",
      );
      document.documentElement.style.removeProperty(
        "--workspace-peek-panel-width",
      );
      document.documentElement.style.removeProperty(
        "--workspace-peek-stage-gap",
      );
    };
  }, [isRailReserved, width]);

  useEffect(
    () => () => {
      if (resizeEndTimeoutRef.current !== undefined) {
        window.clearTimeout(resizeEndTimeoutRef.current);
      }
    },
    [],
  );

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (resizeEndTimeoutRef.current !== undefined) {
        window.clearTimeout(resizeEndTimeoutRef.current);
        resizeEndTimeoutRef.current = undefined;
      }
      setIsResizing(true);
      const startX = event.clientX;
      const startWidth = widthRef.current;
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const { min, max: maxWidth } = getPeekWidthBounds();
        const nextWidth = Math.min(
          Math.max(startWidth + startX - moveEvent.clientX, min),
          maxWidth,
        );
        widthRef.current = nextWidth;
        document.documentElement.style.setProperty(
          "--workspace-peek-rail-width",
          `${nextWidth}px`,
        );
        document.documentElement.style.setProperty(
          "--workspace-peek-panel-width",
          `${nextWidth}px`,
        );
      };
      const finishResize = (deferDismissalRestore: boolean) => {
        const nextWidth = widthRef.current;
        setWidth(nextWidth);
        persistPeekWidth(workspaceSlug, nextWidth);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("blur", handlePointerCancel);

        if (!deferDismissalRestore) {
          setIsResizing(false);
          return;
        }

        resizeEndTimeoutRef.current = window.setTimeout(() => {
          resizeEndTimeoutRef.current = undefined;
          setIsResizing(false);
        }, 0);
      };
      const handlePointerUp = () => finishResize(true);
      const handlePointerCancel = () => finishResize(false);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
      window.addEventListener("pointercancel", handlePointerCancel, {
        once: true,
      });
      window.addEventListener("blur", handlePointerCancel, { once: true });
    },
    [workspaceSlug],
  );
  const syncPeekNote = useCallback((asset: NoteAsset) => {
    setTarget((current) => {
      if (current?.type !== "note" || current.asset.id !== asset.id)
        return current;
      const next = { ...current, asset };
      targetCacheRef.current.set(asset.id, next);
      return next;
    });
  }, []);
  const syncPeekImage = useCallback((asset: ImageAsset) => {
    setTarget((current) => {
      if (current?.type !== "image" || current.asset.id !== asset.id) {
        return current;
      }
      const next = { ...current, asset };
      targetCacheRef.current.set(asset.id, next);
      return next;
    });
  }, []);
  const syncPeekVideoNote = useCallback(
    (assetId: string, note: string | null) => {
      setTarget((current) =>
        current?.type === "link" && current.asset.id === assetId
          ? { ...current, asset: { ...current.asset, note } }
          : current,
      );
    },
    [],
  );
  const handleExitComplete = useCallback(() => {
    if (!targetRef.current) setIsRailReserved(false);
  }, []);
  const showAssetInBoard = useCallback(
    async (assetId: string, location: AssetLocation) => {
      try {
        const scopeKey = getAssetLocationScopeKey(workspaceSlug, location);
        useSessionStore.getState().clearFilters(scopeKey);
        const request = {
          id: ++showRequestIdRef.current,
          assetId,
          scopeKey,
        };
        setShowRequest(request);

        if (getCurrentBoardScopeKey(pathname) === scopeKey) {
          if (parseWorkspaceAssetPath(routeLocation.pathname).assetId) {
            await navigateOverlay(
              pathname,
              { view: undefined, asset: undefined },
              true,
            );
          }
          return;
        }

        if (location.type === "inbox") {
          await navigateOverlay(`/${workspaceSlug}/inbox`, {
            view: undefined,
            asset: undefined,
          });
          return;
        }

        await navigateOverlay(
          `/${workspaceSlug}/collections/${[
            location.collectionSlug,
            location.folderPath,
          ]
            .filter(Boolean)
            .join("/")}`,
          { view: undefined, asset: undefined },
        );
      } catch (error) {
        setShowRequest(undefined);
        toast.error(
          getUserFacingApiErrorMessage(error, "Unable to show asset in board."),
        );
      }
    },
    [navigateOverlay, pathname, routeLocation.pathname, workspaceSlug],
  );

  const showPeekedAsset = useCallback(async () => {
    if (!target?.location) return;
    await showAssetInBoard(target.asset.id, target.location);
  }, [showAssetInBoard, target]);

  const consumeShowRequest = useCallback((requestId: number) => {
    setShowRequest((current) =>
      current?.id === requestId ? undefined : current,
    );
  }, []);

  const value = useMemo<WorkspacePeekContextValue>(
    () => ({
      target,
      showRequest,
      activeNoteId,
      isResizing,
      peekNote: (asset, location, options) => {
        return switchPeekTarget(
          asset.id,
          () => {
            setPeekFocusRequest((request) => request + 1);
            setIsRailReserved(true);
            setTarget({ type: "note", asset, location });
            const peekState = {
              peek: asset.id,
              peekScope: undefined,
              peekDescendants: undefined,
            };
            if (options?.demoteMain) pendingDemotionRef.current = peekState;
            else if (!options?.skipNavigation && peekId !== asset.id)
              void navigateOverlay(routeLocation.pathname, peekState);
          },
          options?.skipNavigation,
        );
      },
      peekImage: (asset, location, options) => {
        return switchPeekTarget(
          asset.id,
          () => {
            setPeekFocusRequest((request) => request + 1);
            setIsRailReserved(true);
            setTarget({ type: "image", asset, location });
            const peekState = {
              peek: asset.id,
              peekScope: undefined,
              peekDescendants: undefined,
            };
            if (options?.demoteMain) pendingDemotionRef.current = peekState;
            else if (!options?.skipNavigation && peekId !== asset.id) {
              void navigateOverlay(routeLocation.pathname, peekState);
            }
          },
          options?.skipNavigation,
        );
      },
      peekColor: (asset, scope, options) => {
        return switchPeekTarget(
          asset.id,
          () => {
            setPeekFocusRequest((request) => request + 1);
            setIsRailReserved(true);
            setTarget({
              type: "color",
              asset,
              scope,
              location: getLocationFromColorScope(scope),
            });
            const peekState = {
              peek: asset.id,
              peekScope: encodeColorScope(scope),
              peekDescendants:
                (scope.type === "collection" && scope.includeDescendants) ||
                undefined,
            };
            if (options?.demoteMain) pendingDemotionRef.current = peekState;
            else if (
              !options?.skipNavigation &&
              (peekId !== asset.id ||
                peekSearch.peekScope !== peekState.peekScope ||
                peekSearch.peekDescendants !== peekState.peekDescendants)
            )
              void navigateOverlay(routeLocation.pathname, peekState);
          },
          options?.skipNavigation,
        );
      },
      peekVideo: (asset, location, options) => {
        const video = asset.video;
        if (!video) return Promise.resolve(false);
        return switchPeekTarget(
          asset.id,
          () => {
            setPeekFocusRequest((request) => request + 1);
            setIsRailReserved(true);
            setTarget({
              type: "link",
              asset: { ...asset, video },
              location,
            });
            const peekState = {
              peek: asset.id,
              peekScope: undefined,
              peekDescendants: undefined,
            };
            if (options?.demoteMain) pendingDemotionRef.current = peekState;
            else if (!options?.skipNavigation && peekId !== asset.id)
              void navigateOverlay(routeLocation.pathname, peekState);
          },
          options?.skipNavigation,
        );
      },
      consumePendingDemotion: () => {
        const pending = pendingDemotionRef.current;
        pendingDemotionRef.current = undefined;
        return pending;
      },
      syncPeekVideoNote,
      setActiveNoteId,
      syncPeekNote,
      syncPeekImage,
      setNotePromotionHandler: (handler) => {
        notePromotionHandlerRef.current = handler;
      },
      setMainNoteLeaveHandler: (handler) => {
        mainNoteLeaveHandlerRef.current = handler;
      },
      prepareMainNoteLeave: async () =>
        (await mainNoteLeaveHandlerRef.current?.()) ?? true,
      setPeekNoteFlushHandler: (handler) => {
        peekNoteFlushHandlerRef.current = handler;
      },
      flushPeekNote: async (noteId) => {
        const handler = peekNoteFlushHandlerRef.current;
        return handler ? handler(noteId) : false;
      },
      setPeekImageFlushHandler: (handler) => {
        peekImageFlushHandlerRef.current = handler;
      },
      flushPeekImage: () => {
        return peekImageFlushHandlerRef.current?.() ?? Promise.resolve();
      },
      promotePeekedAsset: async () => {
        if (!target) return;
        if (target.type === "image") await peekImageFlushHandlerRef.current?.();
        const promotedNote =
          target.type === "note"
            ? await peekNoteFlushHandlerRef.current?.(target.asset.id)
            : undefined;
        if (target.type === "note" && !promotedNote) return;
        if (target.type === "link" && mainNoteLeaveHandlerRef.current) {
          const ready = await mainNoteLeaveHandlerRef.current();
          if (!ready) return;
        }
        const promoted =
          target.type === "note" && notePromotionHandlerRef.current
            ? await notePromotionHandlerRef.current(
                promotedNote || target.asset,
              )
            : await assetPromotionHandlerRef.current?.(
                target.asset.id,
                { presentation: "fullscreen" },
              );
        if (promoted) {
          setIsRailReserved(false);
        }
      },
      setAssetPromotionHandler: (handler) => {
        assetPromotionHandlerRef.current = handler;
      },
      showPeekedAsset,
      showAssetInBoard,
      consumeShowRequest,
      setNoteSwapHandler: (handler) => {
        noteSwapHandlerRef.current = handler;
      },
      swapNotes: async () => {
        await noteSwapHandlerRef.current?.();
      },
      closePeek: () => {
        peekSwitchSequenceRef.current += 1;
        const closingId = target?.asset.id;
        void (async () => {
          if (target?.type === "note") {
            const saved = await peekNoteFlushHandlerRef.current?.(
              target.asset.id,
              "close",
            );
            if (!saved) return;
          }
          if (target?.type === "image") {
            await peekImageFlushHandlerRef.current?.();
          }
          if (targetRef.current?.asset.id !== closingId) return;
          setIsRailReserved(false);
          await navigateOverlay(routeLocation.pathname, {
            peek: undefined,
            peekScope: undefined,
            peekDescendants: undefined,
          });
        })();
      },
    }),
    [
      activeNoteId,
      consumeShowRequest,
      isResizing,
      navigateOverlay,
      peekId,
      peekSearch.peekDescendants,
      peekSearch.peekScope,
      routeLocation.pathname,
      showAssetInBoard,
      showPeekedAsset,
      showRequest,
      syncPeekNote,
      syncPeekImage,
      syncPeekVideoNote,
      switchPeekTarget,
      target,
    ],
  );

  return (
    <WorkspacePeekContext.Provider value={value}>
      {children}
      <LinkResolutionPoller workspaceSlug={workspaceSlug} />
      {target ? <WorkspacePeekSwapButton target={target} /> : null}
      <AnimatePresence initial={false} onExitComplete={handleExitComplete}>
        {target ? (
          <WorkspacePeekPanel
            target={target}
            workspaceSlug={workspaceSlug}
            focusRequest={peekFocusRequest}
            onResizeStart={handleResizeStart}
          />
        ) : peekId ? (
          <motion.aside
            aria-label="Loading peeked reference"
            className={cn(
              GLASS_FRAME_CLASS,
              "fixed inset-y-[var(--app-shell-inset)] right-[var(--app-shell-inset)] z-50 hidden w-(--workspace-peek-panel-width) items-center justify-center rounded-xl bg-card md:flex",
            )}
            initial={false}
            animate={SIDE_PANEL_ANIMATE}
            exit={SIDE_PANEL_EXIT}
            transition={SIDE_PANEL_TRANSITION}
          >
            {peekError ? (
              <div className="flex flex-col items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Could not open this reference.
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPeekError(false);
                      setPeekRetry((value) => value + 1);
                    }}
                  >
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigateOverlay(routeLocation.pathname, {
                        peek: undefined,
                        peekScope: undefined,
                        peekDescendants: undefined,
                      });
                    }}
                  >
                    Close peek
                  </Button>
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                Loading reference…
              </span>
            )}
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </WorkspacePeekContext.Provider>
  );
}

function WorkspacePeekSwapButton({ target }: { target: PeekTarget }) {
  const { activeNoteId, swapNotes } = useWorkspacePeek();
  const [isSwapping, setIsSwapping] = useState(false);
  const canSwapNotes =
    target.type === "note" &&
    activeNoteId !== undefined &&
    activeNoteId !== target.asset.id;

  const handleSwap = useCallback(async () => {
    if (isSwapping) return;
    setIsSwapping(true);
    try {
      await swapNotes();
    } finally {
      setIsSwapping(false);
    }
  }, [isSwapping, swapNotes]);

  if (!canSwapNotes) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Swap notes"
            disabled={isSwapping}
            className="fixed top-[calc(var(--app-shell-inset)+4rem)] right-[calc(var(--workspace-peek-panel-width)+var(--app-shell-inset))] z-[60] hidden size-8 translate-x-1/2 rounded-lg border border-border bg-background/95 shadow-none backdrop-blur-xl md:flex"
            onClick={() => void handleSwap()}
          >
            <ArrowLeftRightIcon className="size-4" />
            <span className="sr-only">Swap notes</span>
          </Button>
        }
      />
      <TooltipContent side="bottom">Swap notes</TooltipContent>
    </Tooltip>
  );
}

function WorkspacePeekPanel({
  target,
  workspaceSlug,
  focusRequest,
  onResizeStart,
}: {
  target: PeekTarget;
  workspaceSlug: string;
  focusRequest: number;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const {
    activeNoteId,
    closePeek,
    promotePeekedAsset,
    setPeekImageFlushHandler,
    showPeekedAsset,
    syncPeekImage,
    target: activeTarget,
  } = useWorkspacePeek();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const canPromote =
    !isMobile &&
    (target.type === "link" ||
      target.type === "image" ||
      (target.type === "note" && activeNoteId !== target.asset.id));

  useEffect(() => {
    if (!canPromote) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!matchesKeybinding(event, OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT)) return;
      event.preventDefault();
      event.stopPropagation();
      void promotePeekedAsset();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canPromote, promotePeekedAsset]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closePeek();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePeek]);

  return (
    <motion.aside
      aria-label="Peeked reference"
      className={cn(
        GLASS_FRAME_CLASS,
        "fixed inset-y-[var(--app-shell-inset)] right-[var(--app-shell-inset)] z-50 hidden h-[calc(100dvh-var(--app-shell-inset)-var(--app-shell-inset))] w-(--workspace-peek-panel-width) overflow-visible rounded-xl text-foreground shadow-none ring-1 ring-foreground/10 md:flex md:flex-col",
      )}
      initial={reduceMotion ? false : SIDE_PANEL_INITIAL}
      animate={SIDE_PANEL_ANIMATE}
      exit={reduceMotion ? undefined : SIDE_PANEL_EXIT}
      transition={{
        ...SIDE_PANEL_TRANSITION,
        duration: reduceMotion ? 0 : SIDE_PANEL_TRANSITION.duration,
      }}
    >
      <div
        aria-label="Resize Peek"
        aria-orientation="vertical"
        className="group/resize absolute top-1/2 left-0 z-30 hidden h-20 w-6 -translate-x-1/2 -translate-y-1/2 cursor-col-resize touch-none md:block"
        role="separator"
        onPointerDown={onResizeStart}
      >
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 h-16 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/35 transition-[background-color,height] duration-200 ease-out group-hover/resize:h-20 group-hover/resize:bg-foreground/50 group-active/resize:h-20 group-active/resize:bg-primary"
          style={{ clipPath: "inset(0 50% 0 0)" }}
        />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
        {target.type === "note" ? (
          <PeekNote
            key={target.asset.id}
            note={target.asset}
            workspaceSlug={workspaceSlug}
            focusRequest={focusRequest}
            onClose={closePeek}
            onPromote={canPromote ? promotePeekedAsset : undefined}
            onShow={showPeekedAsset}
            showEnabled={target.location !== undefined}
            readOnly={activeNoteId === target.asset.id}
          />
        ) : target.type === "link" ? (
          <>
            <PeekHeader
              onClose={closePeek}
              onPromote={promotePeekedAsset}
              promoteLabel="Open full screen"
              onShow={showPeekedAsset}
              showEnabled={target.location !== undefined}
              info={
                <AssetTimestampCard
                  createdAt={target.asset.createdAt}
                  updatedAt={target.asset.updatedAt}
                  label="Video details"
                />
              }
            />
            <div className="min-h-0 flex-1 overflow-y-auto bg-background">
              {!isMobile ? (
                <YouTubeVideoContent
                  key={target.asset.video.videoId}
                  asset={target.asset}
                  open={
                    activeTarget?.type === "link" &&
                    activeTarget.asset.id === target.asset.id
                  }
                  workspaceSlug={workspaceSlug}
                  compact
                />
              ) : null}
            </div>
          </>
        ) : target.type === "image" ? (
          <>
            <PeekHeader
              onClose={closePeek}
              onPromote={promotePeekedAsset}
              promoteLabel="Open full screen"
              onShow={showPeekedAsset}
              showEnabled={target.location !== undefined}
              info={
                <AssetTimestampCard
                  createdAt={target.asset.createdAt}
                  updatedAt={target.asset.updatedAt}
                  label="Image details"
                />
              }
            >
              <ImagePeekHeaderActions
                key={target.asset.id}
                asset={target.asset}
                workspaceSlug={workspaceSlug}
              />
            </PeekHeader>
            <ImagePeek
              key={target.asset.id}
              asset={target.asset}
              workspaceSlug={workspaceSlug}
              onAssetChange={syncPeekImage}
              setFlushHandler={setPeekImageFlushHandler}
            />
          </>
        ) : (
          <>
            <PeekHeader
              onClose={closePeek}
              onShow={showPeekedAsset}
              showEnabled={target.location !== undefined}
              info={
                <AssetTimestampCard
                  createdAt={target.asset.createdAt}
                  updatedAt={target.asset.updatedAt}
                  label="Color details"
                />
              }
            />
            <PeekColor
              color={target.asset}
              scope={target.scope}
              workspaceSlug={workspaceSlug}
            />
          </>
        )}
      </div>
    </motion.aside>
  );
}

function PeekHeader({
  onClose,
  onPromote,
  promoteLabel = "Open in main view",
  onShow,
  showEnabled = true,
  children,
  info,
}: {
  onClose: () => void;
  onPromote?: () => Promise<void>;
  promoteLabel?: string;
  onShow?: () => Promise<void>;
  showEnabled?: boolean;
  children?: ReactNode;
  info?: ReactNode;
}) {
  const [isPromoting, setIsPromoting] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const handlePromote = useCallback(async () => {
    if (!onPromote || isPromoting) return;
    setIsPromoting(true);
    try {
      await onPromote();
    } finally {
      setIsPromoting(false);
    }
  }, [isPromoting, onPromote]);
  const handleShow = useCallback(async () => {
    if (!onShow || !showEnabled || isShowing) return;
    setIsShowing(true);
    try {
      await onShow();
    } finally {
      setIsShowing(false);
    }
  }, [isShowing, onShow, showEnabled]);
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center justify-between gap-3 rounded-t-xl rounded-b-none bg-card p-2 ring-0",
      )}
    >
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close Peek"
                className="size-8 rounded-lg"
                onClick={onClose}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close Peek</span>
              </Button>
            }
          />
          <TooltipContent side="bottom">
            <span>Close Peek</span>
            <KbdGroup className="gap-0.5">
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
        {onShow ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg"
                  aria-label="Show in board"
                  disabled={!showEnabled || isShowing}
                  onClick={() => void handleShow()}
                >
                  <LocateFixedIcon className="size-4" />
                  <span className="sr-only">Show in board</span>
                </Button>
              }
            />
            <TooltipContent side="bottom">Show in board</TooltipContent>
          </Tooltip>
        ) : null}
        {onPromote ? (
          <PeekPromotionControl
            label={promoteLabel}
            isPromoting={isPromoting}
            onPromote={handlePromote}
          />
        ) : null}
      </div>
      {children || info ? (
        <div className="flex min-w-0 items-center justify-end gap-0.5">
          {children}
          {info}
        </div>
      ) : null}
    </div>
  );
}

function PeekPromotionControl({
  label,
  isPromoting,
  onPromote,
}: {
  label: string;
  isPromoting: boolean;
  onPromote: () => Promise<void>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={isPromoting}
            className="size-8 rounded-lg"
            onClick={() => void onPromote()}
          >
            <Maximize2Icon className="size-3.5" />
            <span className="sr-only">{label}</span>
          </Button>
        }
      />
      <TooltipContent side="bottom">
        <span>{label}</span>
        <KbdGroup className="gap-0.5">
          <Kbd className="h-4 min-w-4 px-0.5">{getPlatformAlt()}</Kbd>
          <span>+</span>
          <Kbd className="h-4 min-w-4 px-0.5">{getPlatformShift()}</Kbd>
          <span>+</span>
          <Kbd className="h-4 min-w-4 px-0.5">O</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}

function PeekNote({
  note,
  workspaceSlug,
  focusRequest,
  onClose,
  onPromote,
  onShow,
  showEnabled,
  readOnly,
}: {
  note: NoteAsset;
  workspaceSlug: string;
  focusRequest: number;
  onClose: () => void;
  onPromote?: () => Promise<void>;
  onShow: () => Promise<void>;
  showEnabled: boolean;
  readOnly: boolean;
}) {
  useEffect(() => pruneRedundantEditDrafts(), []);
  const {
    peekNote,
    peekColor,
    peekVideo,
    setPeekNoteFlushHandler,
    syncPeekNote,
  } = useWorkspacePeek();
  const { mutateAsync: updateNoteAsync } = useUpdateNote(workspaceSlug);
  const { mutateAsync: deleteAssetAsync } = useDeleteAsset(workspaceSlug);
  const [recoveredDraft] = useState(() =>
    readOnly ? undefined : loadEditDraft(note.id),
  );
  const latest = useRef(recoveredDraft?.content ?? note.content);
  const latestTitle = useRef(recoveredDraft?.title ?? note.title ?? "");
  const committedNote = useRef<NoteAsset>(
    recoveredDraft
      ? {
          ...note,
          content: recoveredDraft.baseContent,
          title: recoveredDraft.baseTitle,
        }
      : note,
  );
  const savePeekDraft = useCallback(
    (content: string, title: string) => {
      const base = committedNote.current;
      saveEditDraft(note.id, content, title, base.content, base.title ?? null);
    },
    [note.id],
  );
  const flushOperation = useRef<Promise<NoteAsset | false> | undefined>(
    undefined,
  );
  const closeRequested = useRef(false);
  const wasDeleted = useRef(false);
  const deletedDuringEdit = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const richTextRef = useRef<NoteRichTextHandle>(null);
  const timer = useRef<number | undefined>(undefined);
  const copiedTimer = useRef<number | undefined>(undefined);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "deleting" | "error"
  >(recoveredDraft ? "saving" : "saved");
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState(latestTitle.current);
  const [highlightColor, setHighlightColor] = useState<NoteHighlightColor>();
  const [highlightMode, setHighlightMode] = useState(false);
  const [canRemoveHighlight, setCanRemoveHighlight] = useState(false);
  useEffect(() => {
    if (!readOnly) return;
    committedNote.current = note;
    latest.current = note.content;
    latestTitle.current = note.title ?? "";
    setTitle(latestTitle.current);
  }, [note, readOnly]);
  const flush = useCallback(
    (noteId: string, mode?: "close"): Promise<NoteAsset | false> => {
      if (noteId !== note.id) return Promise.resolve(false);
      if (deletedDuringEdit.current) return Promise.resolve(false);
      if (wasDeleted.current) return Promise.resolve(committedNote.current);
      if (readOnly) return Promise.resolve(committedNote.current);
      if (mode === "close") closeRequested.current = true;
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
      }
      if (flushOperation.current) return flushOperation.current;
      const operation = (async (): Promise<NoteAsset | false> => {
        for (;;) {
          const content = latest.current;
          const nextTitle = latestTitle.current.trim() || null;
          const current = committedNote.current;
          if (!content.trim() && !nextTitle) {
            if (!closeRequested.current) {
              setSaveState("error");
              toast.error(
                "Add a title or content before leaving this peeked note.",
              );
              return false;
            }
            setSaveState("deleting");
            try {
              await deleteAssetAsync({
                assetId: note.id,
                expectedContent: current.content,
                expectedTitle: current.title ?? null,
              });
              if (
                latest.current !== content ||
                (latestTitle.current.trim() || null) !== nextTitle
              ) {
                deletedDuringEdit.current = true;
                savePeekDraft(latest.current, latestTitle.current);
                setSaveState("error");
                toast.error(
                  "This note was deleted while you edited it. Your new text remains here; copy it before leaving.",
                );
                return false;
              }
              committedNote.current = { ...current, content, title: nextTitle };
              wasDeleted.current = true;
              clearDeletedNoteDrafts(note.id);
              closeRequested.current = false;
              setSaveState("saved");
              return committedNote.current;
            } catch (error) {
              closeRequested.current = false;
              setSaveState("error");
              toast.error(
                getNoteSaveErrorMessage(error, "Could not delete peeked note."),
              );
              return false;
            }
          }
          if (
            content === current.content &&
            nextTitle === (current.title ?? null)
          ) {
            closeRequested.current = false;
            clearEditDraft(note.id, current);
            setSaveState("saved");
            return current;
          }
          setSaveState("saving");
          try {
            const { note: saved } = await updateNoteAsync({
              assetId: note.id,
              content,
              title: nextTitle,
              expectedContent: current.content,
              expectedTitle: current.title ?? null,
            });
            const updated = { ...committedNote.current, ...saved };
            committedNote.current = updated;
            syncPeekNote(updated);
            if (
              latest.current !== content ||
              (latestTitle.current.trim() || null) !== nextTitle
            ) {
              savePeekDraft(latest.current, latestTitle.current);
            }
          } catch (error) {
            closeRequested.current = false;
            setSaveState("error");
            toast.error(
              getNoteSaveErrorMessage(error, "Could not save peeked note."),
            );
            return false;
          }
          if (
            latest.current === content &&
            (latestTitle.current.trim() || null) === nextTitle
          ) {
            closeRequested.current = false;
            clearEditDraft(note.id, committedNote.current);
            setSaveState("saved");
            return committedNote.current;
          }
        }
      })();
      flushOperation.current = operation;
      const clearOperation = () => {
        if (flushOperation.current === operation)
          flushOperation.current = undefined;
      };
      void operation.then(clearOperation, clearOperation);
      return operation;
    },
    [
      deleteAssetAsync,
      note.id,
      readOnly,
      savePeekDraft,
      syncPeekNote,
      updateNoteAsync,
    ],
  );
  const flushRef = useRef(flush);
  const recoveredFlushStartedRef = useRef(false);
  flushRef.current = flush;
  useEffect(() => {
    if (readOnly) return;
    const legacy = loadLegacyEditDraft(note.id);
    if (!legacy || (!legacy.title.trim() && !legacy.content.trim())) return;
    toast.warning(
      "We found earlier changes that couldn’t be restored automatically. Copy them if you still need them.",
      {
        action: {
          label: "Copy changes",
          onClick: () => {
            void navigator.clipboard
              .writeText(
                [legacy.title, legacy.content].filter(Boolean).join("\n\n"),
              )
              .catch(() => toast.error("Could not copy changes."));
          },
        },
      },
    );
  }, [note.id, readOnly]);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      if (
        latest.current !== committedNote.current.content ||
        (latestTitle.current.trim() || null) !==
          (committedNote.current.title ?? null)
      ) {
        void flushRef.current(note.id);
      }
    },
    [note.id],
  );
  useEffect(() => {
    setPeekNoteFlushHandler(flush);
    return () => setPeekNoteFlushHandler(undefined);
  }, [flush, setPeekNoteFlushHandler]);
  useEffect(() => {
    if (!recoveredDraft || readOnly || recoveredFlushStartedRef.current) return;
    recoveredFlushStartedRef.current = true;
    void flush(note.id);
  }, [flush, note.id, readOnly, recoveredDraft]);
  const handleHighlightModeChange = useCallback((active: boolean) => {
    setHighlightMode(active);
    if (!active) setHighlightColor(undefined);
  }, []);
  const save = useCallback(
    (content: string) => {
      latest.current = content;
      savePeekDraft(content, latestTitle.current);
      if (timer.current) window.clearTimeout(timer.current);
      if (!content.trim() && !latestTitle.current.trim()) {
        setSaveState("saved");
        return;
      }
      timer.current = window.setTimeout(() => {
        void flush(note.id);
      }, 700);
    },
    [flush, note.id, savePeekDraft],
  );
  const saveTitle = useCallback(() => {
    if (!readOnly) void flush(note.id);
  }, [flush, note.id, readOnly]);
  const openReferencedVideo = useCallback(
    async (assetId: string) => {
      const { asset, location } = await fetchPeekableAsset(
        workspaceSlug,
        assetId,
      );
      const peekAsset = collectionNodeToAsset(asset);
      if (peekAsset.type === "link" && peekAsset.video) {
        await peekVideo(peekAsset, location);
        return;
      }
      if (peekAsset.type === "link") {
        window.open(peekAsset.originalUrl, "_blank", "noopener,noreferrer");
      }
    },
    [peekVideo, workspaceSlug],
  );
  const openMentionTarget = useCallback(
    async (
      identity: { assetId: number; assetType: "note" | "color" | "link" },
      resolved?: NoteMentionTarget,
    ) => {
      try {
        if (identity.assetType === "link") {
          if (!resolved?.isVideo) {
            if (resolved?.url)
              window.open(resolved.url, "_blank", "noopener,noreferrer");
            return;
          }
        }
        if (!readOnly) {
          const content = richTextRef.current?.getMarkdown() ?? latest.current;
          latest.current = content;
          savePeekDraft(content, latestTitle.current);
          if (!(await flush(note.id))) return;
        }
        if (identity.assetType === "link") {
          await openReferencedVideo(`link-${identity.assetId}`);
          return;
        }
        const { asset, location } = await fetchPeekableAsset(
          workspaceSlug,
          `${identity.assetType}-${identity.assetId}`,
        );
        if (asset.type === "note") {
          peekNote(asset, location);
          return;
        }
        if (asset.type !== "color") return;
        peekColor(
          asset,
          resolved?.collectionSlug
            ? {
                type: "collection",
                collectionSlug: resolved.collectionSlug,
                folderPath: resolved.folderPath ?? undefined,
                includeDescendants: true,
              }
            : { type: "inbox" },
        );
      } catch (error) {
        setSaveState("error");
        toast.error(
          getUserFacingApiErrorMessage(error, "Could not open this reference."),
        );
      }
    },
    [
      note.id,
      flush,
      openReferencedVideo,
      peekColor,
      peekNote,
      readOnly,
      savePeekDraft,
      workspaceSlug,
    ],
  );
  const copyNote = useCallback(() => {
    const body =
      richTextRef.current?.getMarkdown() ??
      parseFrontMatter(latest.current).body;
    const markdown = composeCopiedNoteMarkdown(note.content, body);
    if (!markdown.trim()) {
      toast.error("Nothing to copy yet.");
      return;
    }
    if (typeof navigator.clipboard?.writeText !== "function") {
      toast.error("Clipboard is not available.");
      return;
    }
    void navigator.clipboard
      .writeText(markdown)
      .then(() => {
        setCopied(true);
        if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 1_500);
      })
      .catch(() => toast.error("Unable to copy note."));
  }, [note.content]);
  return (
    <>
      <PeekHeader
        onClose={onClose}
        onPromote={onPromote}
        onShow={onShow}
        showEnabled={showEnabled}
        info={
          <AssetTimestampCard
            createdAt={note.createdAt}
            updatedAt={note.updatedAt}
            label="Note details"
          />
        }
      >
        {readOnly ? (
          <>
            <HoverCard>
              <HoverCardTrigger
                delay={0}
                closeDelay={100}
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Read-only Peek mirror"
                    className="size-8 rounded-lg text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-400/10 dark:hover:text-amber-300"
                  >
                    <TriangleAlertIcon className="size-4" />
                    <span className="sr-only">Read-only Peek mirror</span>
                  </Button>
                }
              />
              <HoverCardContent
                align="end"
                side="bottom"
                sideOffset={8}
                className="w-64 border-border/60 bg-background/95 backdrop-blur-xl"
              >
                <p className="text-sm font-medium">Read-only Peek</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This note is open in the main editor. Edit it there to keep
                  changes synchronized.
                </p>
              </HoverCardContent>
            </HoverCard>
          </>
        ) : (
          <NoteSaveStatus
            state={saveState}
            updatedAt={note.updatedAt ?? note.createdAt}
          />
        )}
        {!readOnly ? (
          <NoteHighlightControl
            editorRef={richTextRef}
            color={highlightColor}
            isHighlighting={highlightMode}
            canRemoveHighlight={canRemoveHighlight}
            onColorChange={setHighlightColor}
            onHighlightingChange={handleHighlightModeChange}
          />
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                aria-label={copied ? "Note copied" : "Copy markdown"}
                onClick={copyNote}
              >
                <CopyFeedbackIcon copied={copied} className="size-4" />
                <span className="sr-only">
                  {copied ? "Copied" : "Copy markdown"}
                </span>
              </Button>
            }
          />
          <TooltipContent side="bottom">
            {copied ? "Copied" : "Copy markdown"}
          </TooltipContent>
        </Tooltip>
      </PeekHeader>
      <div
        ref={contentRef}
        className="note-workspace-scroll-container relative z-10 min-h-0 flex-1 overflow-y-auto rounded-t-xl border-t border-foreground/10 bg-background"
      >
        <div className="mx-auto w-full max-w-3xl px-10 pt-0 pb-10 [&_.ProseMirror]:!pt-8">
          <NoteTitleField
            value={title}
            onChange={(value) => {
              latestTitle.current = value;
              savePeekDraft(latest.current, value);
              setTitle(value);
            }}
            onBlur={saveTitle}
            onEnter={readOnly ? undefined : () => richTextRef.current?.focus()}
            readOnly={readOnly || saveState === "deleting"}
            className="pt-8"
          />
          <NoteRichText
            key={note.id}
            ref={richTextRef}
            markdown={readOnly ? note.content : latest.current}
            workspaceSlug={workspaceSlug}
            sourceNoteId={note.id}
            onOpenMention={(identity, resolved) =>
              void openMentionTarget(identity, resolved)
            }
            editable={!readOnly && saveState !== "deleting"}
            autoFocus={focusRequest > 0}
            scrollContainerRef={contentRef}
            highlightColor={highlightColor}
            highlightMode={highlightMode}
            onHighlightModeChange={handleHighlightModeChange}
            onHighlightSelectionChange={setCanRemoveHighlight}
            onChange={readOnly ? undefined : save}
            onSaveShortcut={() => {
              const content =
                richTextRef.current?.getMarkdown() ?? latest.current;
              if (!readOnly && content.trim()) {
                latest.current = content;
                savePeekDraft(content, latestTitle.current);
                void flush(note.id);
              }
            }}
          />
        </div>
      </div>
    </>
  );
}

function PeekColor({
  color,
  scope,
  workspaceSlug,
}: {
  color: ColorAsset;
  scope: PeekColorScope;
  workspaceSlug: string;
}) {
  const gradient = color.gradient
    ? resolveGradientCss(color.gradient)
    : undefined;
  const search = useWeightedColorImageSearch(
    workspaceSlug,
    scope,
    colorAssetToSearchColors(color),
  );
  const copy = () =>
    void navigator.clipboard
      .writeText(gradient ?? color.hex ?? "")
      .then(() =>
        toast.success(gradient ? "Copied CSS gradient." : "Copied color."),
      )
      .catch(() => toast.error("Unable to copy color."));
  const results = search.data?.results ?? [];
  return (
    <div className="note-workspace-scroll-container relative z-10 min-h-0 flex-1 overflow-y-auto rounded-t-xl border-t border-foreground/10 bg-background">
      <div className="mx-auto w-full max-w-4xl px-8 pt-16 pb-8">
        <div
          className="h-52 rounded-xl ring-1 ring-black/8"
          style={
            gradient
              ? { background: gradient }
              : { backgroundColor: color.hex ?? "transparent" }
          }
        />
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-lg font-medium">
              {color.title?.trim() || color.hex?.toUpperCase() || "Color"}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {gradient ? "CSS gradient" : color.hex?.toUpperCase()}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={copy}>
            Copy value
          </Button>
        </div>
        <section className="mt-10 border-t pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium">Relevant images</h2>
            <span className="text-xs text-muted-foreground">
              Original location
            </span>
          </div>
          {search.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Searching…</p>
          ) : results.length ? (
            <div className="mt-4 columns-3 gap-3">
              {results.map(({ image }) => (
                <ProgressiveImage
                  key={image.id}
                  src={image.url}
                  blurDataURL={image.blurDataURL ?? undefined}
                  alt={image.alt ?? image.title ?? "Color match"}
                  className="mb-3 w-full break-inside-avoid rounded-lg"
                  loading="lazy"
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No matching images in the original location.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function readTarget(workspaceSlug: string): PeekTarget | undefined {
  try {
    const raw = sessionStorage.getItem(storageKey(workspaceSlug));
    if (!raw) return undefined;
    const value = JSON.parse(raw) as PeekTarget;
    if (
      (value.type === "note" ||
        value.type === "image" ||
        value.type === "color" ||
        (value.type === "link" &&
          value.asset?.video?.provider === "youtube")) &&
      value.asset?.id
    )
      return value;
  } catch {}
  return undefined;
}
