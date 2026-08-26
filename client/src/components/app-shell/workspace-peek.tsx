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
  DotIcon,
  InfoIcon,
  PanelRightCloseIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteRichText } from "@/components/board/note-rich-text";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpdateNote } from "@/api/collection";
import { fetchPeekableAsset } from "@/api/collection/fetchers";
import { gradientToCss } from "@/lib/color-gradient";
import { colorAssetToSearchColors } from "@/lib/color-asset-search";
import { parseFrontMatter } from "@/lib/front-matter";
import { composeCopiedNoteMarkdown } from "@/lib/note-copy";
import { useWeightedColorImageSearch } from "@/api/color-search";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { ColorAsset, NoteAsset } from "@/types/asset";
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
  closePeek: () => void;
};

const WorkspacePeekContext = createContext<WorkspacePeekContextValue | null>(
  null,
);
const PEEK_MIN_WIDTH = 720;
const PEEK_WIDTH = 960;
const PEEK_SAVE_STATUS_VISIBLE_MS = 2_000;

function getPeekWidthBounds() {
  const viewportMax =
    typeof window === "undefined" ? PEEK_WIDTH : window.innerWidth * 0.5;
  const max = viewportMax;
  const min = Math.min(PEEK_MIN_WIDTH, max);
  return { min, max, defaultWidth: Math.min(PEEK_WIDTH, max) };
}
const storageKey = (workspaceSlug: string) =>
  `aska.workspace-peek:v1:${workspaceSlug}`;

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
  const [width, setWidth] = useState(() => getPeekWidthBounds().defaultWidth);
  const widthRef = useRef(width);
  const targetRef = useRef(target);
  const resizeEndTimeoutRef = useRef<number | undefined>(undefined);
  widthRef.current = width;
  targetRef.current = target;

  useEffect(() => {
    const restoredTarget = readTarget(workspaceSlug);
    setTarget(restoredTarget);
    setIsRailReserved(Boolean(restoredTarget));
    setWidth(getPeekWidthBounds().defaultWidth);
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
                asset: { ...asset, color: asset.color ?? undefined },
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
        setWidth(widthRef.current);
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
    [],
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
        setActiveNoteId(undefined);
        setIsRailReserved(true);
        setTarget({ type: "note", asset });
      },
      peekColor: (asset, scope) => {
        setIsRailReserved(true);
        setTarget({ type: "color", asset, scope });
      },
      setActiveNoteId,
      syncPeekNote,
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
      <AnimatePresence initial={false} onExitComplete={handleExitComplete}>
        {target ? (
          <WorkspacePeekPanel
            target={target}
            workspaceSlug={workspaceSlug}
            onResizeStart={handleResizeStart}
          />
        ) : null}
      </AnimatePresence>
    </WorkspacePeekContext.Provider>
  );
}

function WorkspacePeekPanel({
  target,
  workspaceSlug,
  onResizeStart,
}: {
  target: PeekTarget;
  workspaceSlug: string;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { activeNoteId, closePeek } = useWorkspacePeek();
  const reduceMotion = useReducedMotion();
  return (
    <motion.aside
      aria-label="Peeked reference"
      className={cn(
        GLASS_FRAME_CLASS,
        "fixed inset-y-[var(--app-shell-inset)] right-[var(--app-shell-inset)] z-40 hidden h-[calc(100dvh-var(--app-shell-inset)-var(--app-shell-inset))] w-(--workspace-peek-panel-width) overflow-visible rounded-xl text-foreground shadow-none ring-1 ring-foreground/10 md:flex md:flex-col",
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
            onClose={closePeek}
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
  children,
}: {
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center justify-between gap-3 rounded-t-xl rounded-b-none bg-card p-2 ring-0",
      )}
    >
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
              <PanelRightCloseIcon className="size-4" />
              <span className="sr-only">Close Peek</span>
            </Button>
          }
        />
        <TooltipContent side="bottom">Close Peek</TooltipContent>
      </Tooltip>
      {children ? (
        <div className="flex min-w-0 items-center justify-end gap-0">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function PeekNote({
  note,
  workspaceSlug,
  onClose,
  readOnly,
}: {
  note: NoteAsset;
  workspaceSlug: string;
  onClose: () => void;
  readOnly: boolean;
}) {
  const update = useUpdateNote(workspaceSlug);
  const latest = useRef(note.content);
  const contentRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const copiedTimer = useRef<number | undefined>(undefined);
  const saveStatusTimer = useRef<number | undefined>(undefined);
  const hasObservedSaveState = useRef(false);
  const [draft, setDraft] = useState(note.content);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [showSaveState, setShowSaveState] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    latest.current = note.content;
    setDraft(note.content);
    setSaveState("saved");
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current);
    };
  }, [note.id, note.content]);
  useEffect(() => {
    if (saveStatusTimer.current) window.clearTimeout(saveStatusTimer.current);
    if (!hasObservedSaveState.current) {
      hasObservedSaveState.current = true;
      return;
    }
    setShowSaveState(true);
    if (saveState === "saved") {
      saveStatusTimer.current = window.setTimeout(
        () => setShowSaveState(false),
        PEEK_SAVE_STATUS_VISIBLE_MS,
      );
    }
  }, [saveState]);
  const save = useCallback(
    (content: string) => {
      latest.current = content;
      setDraft(content);
      if (timer.current) window.clearTimeout(timer.current);
      if (saveStatusTimer.current) {
        window.clearTimeout(saveStatusTimer.current);
        saveStatusTimer.current = undefined;
      }
      setShowSaveState(false);
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
  const copyNote = useCallback(() => {
    const markdown = composeCopiedNoteMarkdown(
      note.content,
      parseFrontMatter(draft).body,
    );
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
  }, [draft, note.content]);
  const metrics = useMemo(() => {
    const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
    if (!words) return undefined;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return {
      words: `${words.toLocaleString()} words`,
      readingTime: `${minutes} ${minutes === 1 ? "min" : "mins"} read`,
    };
  }, [draft]);
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Save failed"
        : "Saved";
  const hasDetails = Boolean(note.createdAt || note.updatedAt);
  return (
    <>
      <PeekHeader onClose={onClose}>
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
            <span
              className="mx-2 hidden h-4 w-px bg-border sm:block"
              aria-hidden="true"
            />
          </>
        ) : (
          <span
            className={cn(
              "inline-block w-24 text-right text-xs text-muted-foreground transition-opacity duration-100 ease-out motion-reduce:transition-none",
              showSaveState ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!showSaveState}
          >
            {saveLabel}
          </span>
        )}
        {metrics ? (
          <>
            {!readOnly ? (
              <span
                className={cn(
                  "mx-3 hidden h-4 w-px bg-border transition-opacity duration-100 ease-out motion-reduce:transition-none sm:block",
                  showSaveState ? "opacity-100" : "opacity-0",
                )}
                aria-hidden="true"
              />
            ) : null}
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {metrics.words}
            </span>
            <DotIcon
              className="mx-1.5 hidden size-3 text-muted-foreground sm:block"
              aria-hidden="true"
            />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {metrics.readingTime}
            </span>
          </>
        ) : null}
        {metrics ? (
          <span
            className="mx-2 hidden h-4 w-px bg-border sm:block"
            aria-hidden="true"
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
                    <span>{formatPeekDate(note.createdAt)}</span>
                  </div>
                ) : null}
                {note.updatedAt ? (
                  <div>
                    <span className="text-muted-foreground">Updated </span>
                    <span>{formatPeekRelativeTime(note.updatedAt)}</span>
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
          <NoteRichText
            key={note.id}
            markdown={note.content}
            editable={!readOnly}
            scrollContainerRef={contentRef}
            onChange={readOnly ? undefined : save}
            onSaveShortcut={() => {
              if (!readOnly && latest.current.trim()) {
                setSaveState("saving");
                update.mutate(
                  { assetId: note.id, content: latest.current },
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

const PEEK_NOTE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const PEEK_NOTE_DATE_WITH_YEAR_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatPeekDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.getFullYear() === new Date().getFullYear()
    ? PEEK_NOTE_DATE_FORMAT.format(date)
    : PEEK_NOTE_DATE_WITH_YEAR_FORMAT.format(date);
}

function formatPeekRelativeTime(iso: string) {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs)) return "";
  if (elapsedMs < 60_000) return "just now";
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatPeekDate(iso);
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
    <div className="note-workspace-scroll-container min-h-0 flex-1 overflow-y-auto">
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
