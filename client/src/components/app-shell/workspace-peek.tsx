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
  CheckIcon,
  CopyIcon,
  InfoIcon,
  ArrowLeftRightIcon,
  Maximize2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import { NoteHighlightControl } from "@/components/board/note-highlight-control";
import { NoteSaveStatus } from "@/components/board/note-save-status";
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
import { useUpdateNote } from "@/api/collection";
import { fetchPeekableAsset } from "@/api/collection/fetchers";
import type { NoteMentionTarget } from "@/api/note-mentions/types";
import { gradientToCss } from "@/lib/color-gradient";
import { colorAssetToSearchColors } from "@/lib/color-asset-search";
import { parseFrontMatter } from "@/lib/front-matter";
import {
  matchesKeybinding,
  OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT,
} from "@/lib/keybindings";
import { composeCopiedNoteMarkdown } from "@/lib/note-copy";
import { formatNoteMetadataDateTime } from "@/lib/note-date-format";
import { getPlatformAlt, getPlatformShift } from "@/lib/platform";
import { useWeightedColorImageSearch } from "@/api/color-search";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ColorAsset, NoteAsset } from "@/types/asset";
import type { NoteHighlightColor } from "@/lib/note-highlights";
import {
  SIDE_PANEL_ANIMATE,
  SIDE_PANEL_EXIT,
  SIDE_PANEL_INITIAL,
  SIDE_PANEL_TRANSITION,
} from "./side-panel-motion";

export type PeekColorScope =
  | { type: "inbox" }
  | {
      type: "collection";
      collectionSlug: string;
      folderPath?: string;
      includeDescendants: boolean;
    };

type PeekTarget =
  | { type: "note"; asset: NoteAsset }
  | { type: "color"; asset: ColorAsset; scope: PeekColorScope };

type WorkspacePeekContextValue = {
  target?: PeekTarget;
  activeNoteId?: string;
  isResizing: boolean;
  peekNote: (note: NoteAsset) => void;
  peekColor: (color: ColorAsset, scope: PeekColorScope) => void;
  setActiveNoteId: (noteId?: string) => void;
  syncPeekNote: (note: NoteAsset) => void;
  setNotePromotionHandler: (
    handler?: (note: NoteAsset) => Promise<boolean>,
  ) => void;
  promoteNote: () => Promise<void>;
  setNoteSwapHandler: (handler?: () => Promise<void>) => void;
  swapNotes: () => Promise<void>;
  closePeek: () => void;
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
  const [target, setTarget] = useState<PeekTarget | undefined>(() =>
    readTarget(workspaceSlug),
  );
  const [isRailReserved, setIsRailReserved] = useState(() => Boolean(target));
  const [activeNoteId, setActiveNoteId] = useState<string>();
  const [isResizing, setIsResizing] = useState(false);
  const [peekFocusRequest, setPeekFocusRequest] = useState(0);
  const [width, setWidth] = useState(() => readPeekWidth(workspaceSlug));
  const widthRef = useRef(width);
  const targetRef = useRef(target);
  const notePromotionHandlerRef = useRef<
    ((note: NoteAsset) => Promise<boolean>) | undefined
  >(undefined);
  const noteSwapHandlerRef = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );
  const resizeEndTimeoutRef = useRef<number | undefined>(undefined);
  widthRef.current = width;
  targetRef.current = target;

  useEffect(() => {
    const restoredTarget = readTarget(workspaceSlug);
    setPeekFocusRequest(0);
    setTarget(restoredTarget);
    setIsRailReserved(Boolean(restoredTarget));
    setWidth(readPeekWidth(workspaceSlug));
  }, [workspaceSlug]);
  useEffect(() => {
    if (!target) return;
    let active = true;
    void fetchPeekableAsset(workspaceSlug, target.asset.id)
      .then(({ asset }) => {
        if (!active || asset.type !== target.type) return;
        setTarget((current) =>
          current?.type === "note" && asset.type === "note"
            ? {
                type: "note",
                asset,
              }
            : current?.type === "color" && asset.type === "color"
              ? { ...current, asset }
              : current,
        );
      })
      // A transient network failure must not discard an active reference. The
      // persisted value remains available and the next workspace load retries.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [target?.asset.id, target?.type, workspaceSlug]);
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

  useEffect(() => {
    try {
      if (target)
        sessionStorage.setItem(
          storageKey(workspaceSlug),
          JSON.stringify(target),
        );
      else sessionStorage.removeItem(storageKey(workspaceSlug));
    } catch {}
  }, [target, workspaceSlug]);
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
    setTarget((current) =>
      current?.type === "note" && current.asset.id === asset.id
        ? { type: "note", asset }
        : current,
    );
  }, []);
  const handleExitComplete = useCallback(() => {
    if (!targetRef.current) setIsRailReserved(false);
  }, []);

  const value = useMemo<WorkspacePeekContextValue>(
    () => ({
      target,
      activeNoteId,
      isResizing,
      peekNote: (asset) => {
        setPeekFocusRequest((request) => request + 1);
        setActiveNoteId(undefined);
        setIsRailReserved(true);
        setTarget({ type: "note", asset });
      },
      peekColor: (asset, scope) => {
        setPeekFocusRequest((request) => request + 1);
        setIsRailReserved(true);
        setTarget({ type: "color", asset, scope });
      },
      setActiveNoteId,
      syncPeekNote,
      setNotePromotionHandler: (handler) => {
        notePromotionHandlerRef.current = handler;
      },
      promoteNote: async () => {
        if (target?.type !== "note") return;
        const promoted = await notePromotionHandlerRef.current?.(target.asset);
        if (promoted) {
          setIsRailReserved(false);
          setTarget(undefined);
        }
      },
      setNoteSwapHandler: (handler) => {
        noteSwapHandlerRef.current = handler;
      },
      swapNotes: async () => {
        await noteSwapHandlerRef.current?.();
      },
      closePeek: () => {
        setIsRailReserved(false);
        setTarget(undefined);
      },
    }),
    [activeNoteId, isResizing, syncPeekNote, target],
  );

  return (
    <WorkspacePeekContext.Provider value={value}>
      {children}
      {target ? <WorkspacePeekSwapButton target={target} /> : null}
      <AnimatePresence initial={false} onExitComplete={handleExitComplete}>
        {target ? (
          <WorkspacePeekPanel
            target={target}
            workspaceSlug={workspaceSlug}
            focusRequest={peekFocusRequest}
            onResizeStart={handleResizeStart}
          />
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
            className="fixed top-[calc(var(--app-shell-inset)+4rem)] right-[calc(var(--workspace-peek-panel-width)+var(--app-shell-inset))] z-[60] hidden size-8 translate-x-1/2 rounded-lg border border-border bg-background/95 text-muted-foreground shadow-none backdrop-blur-xl hover:bg-secondary hover:text-foreground md:flex"
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
  const { activeNoteId, closePeek, promoteNote } = useWorkspacePeek();
  const reduceMotion = useReducedMotion();
  const canPromote = target.type === "note" && activeNoteId !== target.asset.id;

  useEffect(() => {
    if (!canPromote) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!matchesKeybinding(event, OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT)) return;
      event.preventDefault();
      event.stopPropagation();
      void promoteNote();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canPromote, promoteNote]);

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
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
        {target.type === "note" ? (
          <PeekNote
            note={target.asset}
            workspaceSlug={workspaceSlug}
            focusRequest={focusRequest}
            onClose={closePeek}
            onPromote={canPromote ? promoteNote : undefined}
            readOnly={activeNoteId === target.asset.id}
          />
        ) : (
          <>
            <PeekHeader onClose={closePeek} />
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
  children,
}: {
  onClose: () => void;
  onPromote?: () => Promise<void>;
  children?: ReactNode;
}) {
  const [isPromoting, setIsPromoting] = useState(false);
  const handlePromote = useCallback(async () => {
    if (!onPromote || isPromoting) return;
    setIsPromoting(true);
    try {
      await onPromote();
    } finally {
      setIsPromoting(false);
    }
  }, [isPromoting, onPromote]);
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center justify-between gap-3 rounded-t-xl rounded-b-none bg-card p-2 ring-0",
      )}
    >
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close Peek"
                className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={onClose}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close Peek</span>
              </Button>
            }
          />
          <TooltipContent side="bottom">Close Peek</TooltipContent>
        </Tooltip>
        {onPromote ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Open in main editor"
                  disabled={isPromoting}
                  className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => void handlePromote()}
                >
                  <Maximize2Icon className="size-3.5" />
                  <span className="sr-only">Open in main editor</span>
                </Button>
              }
            />
            <TooltipContent side="bottom">
              <span>Open in main editor</span>
              <KbdGroup className="gap-0.5">
                <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                  {getPlatformAlt()}
                </Kbd>
                <span>+</span>
                <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                  {getPlatformShift()}
                </Kbd>
                <span>+</span>
                <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">O</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {children ? (
        <div className="flex min-w-0 items-center justify-end gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function PeekNote({
  note,
  workspaceSlug,
  focusRequest,
  onClose,
  onPromote,
  readOnly,
}: {
  note: NoteAsset;
  workspaceSlug: string;
  focusRequest: number;
  onClose: () => void;
  onPromote?: () => Promise<void>;
  readOnly: boolean;
}) {
  const { peekNote, peekColor } = useWorkspacePeek();
  const update = useUpdateNote(workspaceSlug);
  const latest = useRef(note.content);
  const contentRef = useRef<HTMLDivElement>(null);
  const richTextRef = useRef<NoteRichTextHandle>(null);
  const timer = useRef<number | undefined>(undefined);
  const copiedTimer = useRef<number | undefined>(undefined);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState(note.title ?? "");
  const [highlightColor, setHighlightColor] = useState<NoteHighlightColor>();
  const [highlightMode, setHighlightMode] = useState(false);
  const [canRemoveHighlight, setCanRemoveHighlight] = useState(false);
  useEffect(() => {
    latest.current = note.content;
    setTitle(note.title ?? "");
    setSaveState("saved");
    setHighlightMode(false);
    setHighlightColor(undefined);
    setCanRemoveHighlight(false);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, [note.id, note.content]);
  const handleHighlightModeChange = useCallback((active: boolean) => {
    setHighlightMode(active);
    if (!active) setHighlightColor(undefined);
  }, []);
  const save = useCallback(
    (content: string) => {
      latest.current = content;
      if (timer.current) window.clearTimeout(timer.current);
      if (!content.trim()) {
        setSaveState("saved");
        return;
      }
      timer.current = window.setTimeout(() => {
        setSaveState("saving");
        update.mutate(
          { assetId: note.id, content },
          {
            onSuccess: () => setSaveState("saved"),
            onError: () => {
              setSaveState("error");
              toast.error("Could not save peeked note.");
            },
          },
        );
      }, 700);
    },
    [note.id, update],
  );
  const saveTitle = useCallback(() => {
    const nextTitle = title.trim() || null;
    if (nextTitle === (note.title ?? null) || readOnly) return;
    update.mutate(
      { assetId: note.id, title: nextTitle },
      { onError: () => toast.error("Could not save peeked note.") },
    );
  }, [note.id, note.title, readOnly, title, update]);
  const openMentionTarget = useCallback(
    async (
      identity: { assetId: number; assetType: "note" | "color" },
      resolved?: NoteMentionTarget,
    ) => {
      try {
        if (!readOnly) {
          const content = richTextRef.current?.getMarkdown() ?? latest.current;
          if (timer.current) window.clearTimeout(timer.current);
          if (content !== note.content) {
            setSaveState("saving");
            await update.mutateAsync({ assetId: note.id, content });
            setSaveState("saved");
          }
        }
        const { asset } = await fetchPeekableAsset(
          workspaceSlug,
          `${identity.assetType}-${identity.assetId}`,
        );
        if (asset.type === "note") {
          peekNote(asset);
          return;
        }
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
      note.content,
      note.id,
      peekColor,
      peekNote,
      readOnly,
      update,
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
  const hasDetails = Boolean(note.createdAt || note.updatedAt);
  return (
    <>
      <PeekHeader onClose={onClose} onPromote={onPromote}>
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
                className="w-64 border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl"
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
                className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={copied ? "Note copied" : "Copy markdown"}
                onClick={copyNote}
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
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
        {hasDetails ? (
          <HoverCard>
            <HoverCardTrigger
              delay={0}
              closeDelay={100}
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground"
                  aria-label="Note details"
                >
                  <InfoIcon className="size-4" />
                </Button>
              }
            />
            <HoverCardContent
              align="end"
              side="bottom"
              sideOffset={8}
              className="w-fit min-w-0 border-border/60 bg-background/95 whitespace-nowrap shadow-2xl backdrop-blur-xl"
            >
              <div className="flex flex-col gap-1 text-xs">
                {note.createdAt ? (
                  <div>
                    <span className="text-muted-foreground">Created at </span>
                    <span>{formatNoteMetadataDateTime(note.createdAt)}</span>
                  </div>
                ) : null}
                {note.updatedAt ? (
                  <div>
                    <span className="text-muted-foreground">Edited </span>
                    <span>{formatNoteMetadataDateTime(note.updatedAt)}</span>
                  </div>
                ) : null}
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : null}
      </PeekHeader>
      <div
        ref={contentRef}
        className="note-workspace-scroll-container relative z-10 min-h-0 flex-1 overflow-y-auto rounded-t-xl border-t border-foreground/10 bg-background"
      >
        <div className="mx-auto w-full max-w-3xl px-10 pt-0 pb-10 [&_.ProseMirror]:!pt-8">
          <NoteTitleField
            value={title}
            onChange={setTitle}
            onBlur={saveTitle}
            readOnly={readOnly}
            className="pt-8"
          />
          <NoteRichText
            key={note.id}
            ref={richTextRef}
            markdown={note.content}
            workspaceSlug={workspaceSlug}
            sourceNoteId={note.id}
            onOpenMention={(identity, resolved) =>
              void openMentionTarget(identity, resolved)
            }
            editable={!readOnly}
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
                setSaveState("saving");
                update.mutate(
                  { assetId: note.id, content },
                  {
                    onSuccess: () => setSaveState("saved"),
                    onError: () => {
                      setSaveState("error");
                      toast.error("Could not save peeked note.");
                    },
                  },
                );
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
    ? gradientToCss(
        color.gradient.stops ?? [
          { color: color.gradient.from, position: 0 },
          { color: color.gradient.to, position: 100 },
        ],
        color.gradient.type ?? "linear",
        color.gradient.angle,
      )
    : undefined;
  const search = useWeightedColorImageSearch(
    workspaceSlug,
    scope,
    colorAssetToSearchColors(color),
  );
  const copy = () =>
    void navigator.clipboard
      .writeText(gradient ?? color.hex)
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
            gradient ? { background: gradient } : { backgroundColor: color.hex }
          }
        />
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-lg font-medium">
              {color.title?.trim() || color.hex.toUpperCase()}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {gradient ? "CSS gradient" : color.hex.toUpperCase()}
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
    if ((value.type === "note" || value.type === "color") && value.asset?.id)
      return value;
  } catch {}
  return undefined;
}
