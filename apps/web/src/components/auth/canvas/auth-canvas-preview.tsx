import {
  ArrowUpIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  PanelRightIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ColorAssetCard } from "@/components/board/cards/color-asset-card";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { LinkAssetCard } from "@/components/board/cards/link-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { VideoAssetCard } from "@/components/board/cards/video-asset-card";
import { makeArrowPaths } from "@/components/canvas/canvas-arrow-geometry";
import { canvasTextTypography } from "@/components/canvas/canvas-object-style";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";

import { AUTH_TILTED_PLANE } from "../auth-tilted-plane";
import {
  COLORS,
  FOLDER_NAMES,
  furnitureFolder,
  IMAGES,
  INNER_PASTE,
  INNER_PASTE_BOX,
  LAYOUT,
  LINK,
  POOL,
  WALL_NOTE,
  innerBoard,
  lightingFolder,
  lightingNote,
  type FolderKey,
} from "./auth-canvas-scene";
import {
  AGENT_LINES,
  AGENT_PROMPT,
  ARROW_BEND,
  ARROW_FROM,
  ARROW_MID,
  ARROW_TO,
  CANVAS_TEXT,
  CHAPTER_CAPTIONS,
  FRAMES,
  INNER_NOTE_DROP,
  NOTE_MOVE,
  SEARCH_COLOR,
  SEARCH_MATCHES,
  TEXT_AT,
  nextCheckpoint,
  type AgentPhase,
  type CanvasTool,
  type CursorState,
  type CursorTarget,
  type Point,
} from "./auth-canvas-timeline";

/**
 * Where the shared timeline is. Module state, so it survives the panel
 * remounting on each route: a new view fast-forwards to the next checkpoint
 * instead of starting over.
 */
const clock = { position: 0, started: false };

// The camera's last pose, so it glides on from where the previous view left it.
let lastCamera: { x: number; y: number; scale: number } | undefined;

// The folder being looked inside right now, if any. A view that mounts while
// one is open starts with it open and closes it as the camera pulls back.
let insideFolder: FolderKey | null = null;

const CAMERA_EASE = [0.65, 0, 0.35, 1] as const;
const MOVE_EASE = [0.45, 0, 0.2, 1] as const;
// How long a new view waits before the timeline moves on.
const SETTLE_MS = 120;
// A key press inside the form pauses the timeline for this long.
const TYPING_PAUSE_MS = 2500;

const CARD_SHADOW =
  "[&>*]:shadow-[0_0.5rem_1rem_-0.75rem_color-mix(in_oklch,var(--foreground)_14%,transparent)]";
const DIM_CLASS = "[&>*]:opacity-30 [&>*]:saturate-50";
const FOCUS_CLASS =
  "[&>*]:outline-2 [&>*]:outline-offset-2 [&>*]:outline-primary";

/** The session-store scope of the panel's own filter bar. */
const FILTER_SCOPE = "auth-preview";

type ChromeTarget =
  | "swatch"
  | "matchNext"
  | "filterClear"
  | "agentInput"
  | "agentKeep";

/** The "Copy hex" badge's own hover look, applied while the cursor is on it. */
const PILL_HOVER_CLASS = "bg-sidebar/90 ring-1 ring-sidebar-foreground/25";

const noop = () => {};

/** What the agent wrote, as it reads in the note card once kept. */
const AGENT_NOTE_EXTRA = [
  AGENT_LINES[0],
  ...AGENT_LINES.slice(1).map((line) => `- ${line}`),
].join("\n");

const LIFT_SHADOW = "drop-shadow(0 18px 14px rgb(0 0 0 / 0.2))";
const NO_SHADOW = "drop-shadow(0 0 0 rgb(0 0 0 / 0))";

const FALLBACK_BOXES: Point[] = [
  { x: 337, y: 410 },
  { x: 337, y: 432 },
];

/** Where the cursor aims to click "Studio refresh" in the breadcrumb. */
const CRUMB_TARGET: Point = { x: 66, y: 31 };

const DRAG_POSES = [
  { y: 0, scale: 1, rotate: 0, opacity: 1, lift: false },
  { y: 0, scale: 1.04, rotate: -1.5, opacity: 1, lift: true },
  { y: 290, scale: 0.92, rotate: -1.5, opacity: 1, lift: true },
  { y: 290, scale: 0.92, rotate: -1.5, opacity: 1, lift: true },
  { y: 320, scale: 0.4, rotate: 0, opacity: 0, lift: false },
];
const DRAG_DURATIONS = [0.3, 0.2, 0.5, 0.15, 0.25];

function offsetWithin(element: HTMLElement, ancestor: HTMLElement): Point {
  let x = 0;
  let y = 0;
  let current: HTMLElement | null = element;
  while (current && current !== ancestor) {
    x += current.offsetLeft;
    y += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function Placed({
  box,
  children,
  className,
  ...motionProps
}: {
  box: { x: number; y: number; w: number };
  children: ReactNode;
  className?: string;
} & React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      initial={false}
      {...motionProps}
      className={`absolute ${CARD_SHADOW} ${className ?? ""}`}
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        ...motionProps.style,
      }}
    >
      {children}
    </motion.div>
  );
}

function arrive(visible: boolean, delay = 0) {
  return {
    initial: visible ? false : { opacity: 0, scale: 0.94, y: 10 },
    animate: {
      opacity: visible ? 1 : 0,
      scale: visible ? 1 : 0.94,
      y: visible ? 0 : 10,
    },
    transition: {
      duration: 0.28,
      delay: visible ? delay : 0,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

/**
 * The pointer, or the cursor the canvas shows for a tool: an I-beam for the
 * text tool and a crosshair for the arrow tool.
 */
function CursorShape({ tool = "select" }: { tool?: CanvasTool }) {
  if (tool === "select") {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_2px_3px_rgb(0_0_0_/_0.25)]"
      >
        <path
          d="M3 2l13 6.6-5.6 1.7L7.6 16z"
          fill="white"
          stroke="#1a1a1a"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Both tool cursors are centred on the point they act on.
  const d =
    tool === "text"
      ? "M7.5 3.5h2.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7.5M14.5 3.5H12a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h2.5M9 11h4"
      : "M11 2.5v17M2.5 11h17";
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      className="-translate-x-[11px] -translate-y-[11px] drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.3)]"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} stroke="#1a1a1a" strokeWidth="3.2" />
      <path d={d} stroke="white" strokeWidth="1.4" />
    </svg>
  );
}

/** A cursor that keeps one on-screen size whatever its parent's scale is. */
function Cursor({
  point,
  state,
  parentScale,
  tool,
}: {
  point: Point;
  state: CursorState;
  parentScale: number;
  tool?: CanvasTool;
}) {
  return (
    <motion.div
      aria-hidden="true"
      className="absolute top-0 left-0 z-[40]"
      initial={false}
      animate={{
        x: point.x,
        y: point.y,
        opacity: state.visible ? 1 : 0,
        scale: state.press ? 0.88 : 1,
      }}
      transition={{ duration: 0.5, ease: MOVE_EASE }}
    >
      <motion.div
        initial={false}
        animate={{ scale: 1 / parentScale }}
        transition={{ duration: 0.7, ease: CAMERA_EASE }}
        style={{
          transformOrigin: tool && tool !== "select" ? "0 0" : "3px 2px",
        }}
      >
        <CursorShape tool={tool} />
      </motion.div>
    </motion.div>
  );
}

/** The inside of a folder, shown on top of the board once the camera is in. */
function FolderBoard({
  folder,
  hasLamp,
  open,
  fit,
  pasted,
  moved,
  lift,
  cursor,
  noteExtra = "",
  grid = false,
}: {
  folder: FolderKey;
  hasLamp: boolean;
  open: boolean;
  fit: number;
  pasted: boolean;
  moved: boolean;
  lift: boolean;
  cursor?: { point: Point; state: CursorState };
  /** What the agent added to the note, once kept. */
  noteExtra?: string;
  /** Show the folder as a tidy grid instead of the hand-placed canvas. */
  grid?: boolean;
}) {
  const cards = useMemo(
    () => innerBoard(folder, hasLamp, noteExtra),
    [folder, hasLamp, noteExtra],
  );
  const incoming = INNER_PASTE[folder];
  const scale = fit * 0.85;

  // Grid view: three columns, each card dropped into the shortest one.
  const gridSpots = useMemo(() => {
    const columns = [-384, -120, 144].map((x) => ({ x, y: -330 }));
    const place = (height: number) => {
      const column = columns.reduce((a, b) => (b.y < a.y ? b : a));
      const spot = { x: column.x, y: column.y };
      column.y += height + 24;
      return spot;
    };
    const heightOf = (asset: (typeof cards)[number]["asset"]) =>
      asset.type === "image"
        ? (240 * asset.height) / asset.width
        : noteExtra && asset.id === "auth-sconce-note"
          ? 250
          : 120;
    const spots = new Map<string, Point>();
    for (const card of cards) spots.set(card.key, place(heightOf(card.asset)));
    if (pasted) {
      spots.set(
        "pasted",
        place(
          incoming.type === "image"
            ? (240 * incoming.height) / incoming.width
            : 262,
        ),
      );
    }
    return spots;
  }, [cards, incoming, noteExtra, pasted]);
  const gridOffset = (key: string, home: Point) => {
    const spot = grid ? gridSpots.get(key) : undefined;
    return spot ? { x: spot.x - home.x, y: spot.y - home.y } : { x: 0, y: 0 };
  };
  const pastedOffset = gridOffset("pasted", INNER_PASTE_BOX);

  return (
    <motion.div
      className="absolute inset-0"
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: open ? 0.25 : 0.2, ease: "easeOut" }}
    >
      <div className={`${AUTH_TILTED_PLANE} absolute inset-0`}>
        <div className="absolute -inset-[60%] bg-[color-mix(in_oklch,var(--muted)_58%,var(--background))]" />
        <div className="absolute -inset-[60%] bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_17%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div
          className="absolute top-[44%] left-[50%] size-0"
          style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}
        >
          {cards.map((card) => {
            const isNote = card.asset.type === "note";
            const offset = gridOffset(card.key, card);
            return (
              <motion.div
                key={card.key}
                className={`absolute ${CARD_SHADOW} ${isNote ? "z-[30]" : ""}`}
                style={{ left: card.x, top: card.y, width: 240 }}
                initial={false}
                animate={{
                  x: offset.x,
                  // In the grid the note sits in its slot, not where it was dragged.
                  y:
                    offset.y + (isNote && moved && !grid ? INNER_NOTE_DROP : 0),
                  scale: isNote && lift ? 1.04 : 1,
                  rotate: isNote && lift ? -1.5 : 0,
                  filter: isNote && lift ? LIFT_SHADOW : NO_SHADOW,
                }}
                transition={{ duration: 0.5, ease: MOVE_EASE }}
              >
                {card.asset.type === "image" ? (
                  <ImageAssetCard asset={card.asset} />
                ) : (
                  <NoteAssetCard asset={card.asset} />
                )}
              </motion.div>
            );
          })}
          <motion.div
            className="absolute top-0 left-0"
            initial={false}
            animate={pastedOffset}
            transition={{ duration: 0.5, ease: MOVE_EASE }}
          >
            <Placed box={{ ...INNER_PASTE_BOX }} {...arrive(pasted, 0.25)}>
              {incoming.type === "image" ? (
                <ImageAssetCard asset={incoming} />
              ) : (
                <LinkAssetCard asset={incoming} />
              )}
            </Placed>
          </motion.div>
          {cursor ? (
            <Cursor
              point={cursor.point}
              state={cursor.state}
              parentScale={scale}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

/** Always visible: where you are, and the way back out of a folder. */
function Breadcrumb({
  folder,
  inside,
  hot,
}: {
  folder: FolderKey;
  inside: boolean;
  /** The parent crumb is being clicked. */
  hot: boolean;
}) {
  return (
    <div className="absolute top-4 left-4 z-[3] flex items-center rounded-lg border border-border bg-sidebar/85 px-1.5 py-1 text-xs font-medium text-sidebar-foreground backdrop-blur-sm">
      <span
        className={`px-1.5 py-0.5 transition-colors duration-150 ${
          hot ? "text-sidebar-foreground" : "text-sidebar-foreground/60"
        }`}
      >
        Studio refresh
      </span>
      <motion.span
        className="flex items-center gap-1 overflow-hidden whitespace-nowrap"
        initial={false}
        animate={{ opacity: inside ? 1 : 0, width: inside ? "auto" : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <ChevronRightIcon
          className="size-3 text-sidebar-foreground/35"
          strokeWidth={2}
        />
        <span className="pr-1.5">{FOLDER_NAMES[folder]}</span>
      </motion.span>
    </div>
  );
}

/** Larger keycaps than the default, so the hint reads at a glance. */
const KEY_HINT_CLASS = "h-7 min-w-7 px-1.5 text-sm";

/**
 * The keys of a shortcut, flashed faintly at the top right as it is pressed.
 * ⇧V is the app's own shortcut for switching between canvas and grid.
 */
function KeyHint({ show }: { show: boolean }) {
  return (
    <motion.div
      className="absolute top-4 right-4 z-[4] flex items-center gap-1.5 text-sidebar-foreground"
      initial={false}
      animate={{ opacity: show ? 0.8 : 0, y: show ? 0 : -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Kbd className={KEY_HINT_CLASS}>⇧</Kbd>
      <Kbd className={KEY_HINT_CLASS}>V</Kbd>
    </motion.div>
  );
}

const AGENT_KBD =
  "h-3.5 min-w-3.5 bg-transparent px-0 text-[10px] text-current opacity-60";

/**
 * An open note with the agent at work in it. The prompt, the "Writing…" row
 * and the review actions follow the editor's own agent bar.
 */
function NoteSheet({
  open,
  agent,
  chars,
  lines,
}: {
  open: boolean;
  agent: AgentPhase;
  chars: number;
  lines: number;
}) {
  const drafting = agent === "streaming" || agent === "review";
  return (
    // A centred modal on the board.s own tilted plane, over a dimmed backdrop.
    <div className={`${AUTH_TILTED_PLANE} absolute inset-0 z-[5]`}>
      <motion.div
        className="absolute -inset-[60%] bg-black/35"
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
      <div className="absolute top-[46%] left-1/2 w-[min(90%,37rem)] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className={cn(
            GLASS_FRAME_CLASS,
            "flex min-h-[27rem] flex-col overflow-hidden rounded-lg text-foreground shadow-2xl",
          )}
          initial={false}
          animate={{
            opacity: open ? 1 : 0,
            scale: open ? 1 : 0.96,
            y: open ? 0 : 10,
          }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-0.5 p-2 text-muted-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg">
              <XIcon className="size-4" />
            </span>
            <span className="flex size-8 items-center justify-center rounded-lg">
              <PanelRightIcon className="size-4" />
            </span>
          </div>
          <div className="note-rich-text-content flex-1 rounded-t-lg border-t border-foreground/10 bg-background px-10 pt-8 pb-10 text-sm leading-6">
            <h1 className="mb-2 text-2xl leading-tight font-semibold tracking-tight">
              Sconce options
            </h1>
            <p className="text-sidebar-foreground/80">
              Brass arm, 2700K bulb. Plug-in, so no wiring.
            </p>

            <div className="relative mt-3 ml-3.5">
              <span
                className="note-agent-rail"
                style={{ top: 0 }}
                data-visible={drafting && lines > 0 ? "true" : undefined}
                data-streaming={agent === "streaming" ? "" : undefined}
              />
              {lines > 0 ? (
                <div className="text-sidebar-foreground/80">
                  <p className="note-agent-fresh">{AGENT_LINES[0]}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {AGENT_LINES.slice(1, lines).map((line) => (
                      <li key={line} className="note-agent-fresh">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {agent === "off" || agent === "kept" ? (
                // The empty line the prompt opens on.
                <div data-cursor-target="agentInput" className="h-8" />
              ) : (
                <div className="note-agent-prompt relative my-1.5 font-sans text-sm">
                  {agent === "streaming" ? (
                    <div className="flex h-8 items-center justify-between gap-3">
                      <span className="note-agent-shimmer text-sm">
                        Writing…
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        tabIndex={-1}
                        className="text-muted-foreground"
                      >
                        Stop
                        <Kbd className="h-3.5 min-w-3.5 px-1 text-[10px]">
                          Esc
                        </Kbd>
                      </Button>
                    </div>
                  ) : agent === "review" ? (
                    <div className="flex h-8 items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        tabIndex={-1}
                        className="text-muted-foreground"
                      >
                        <RotateCcwIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        tabIndex={-1}
                      >
                        Discard
                        <Kbd className={AGENT_KBD}>Esc</Kbd>
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="xs"
                        tabIndex={-1}
                        data-cursor-target="agentKeep"
                      >
                        Keep
                        <Kbd className={AGENT_KBD}>↵</Kbd>
                      </Button>
                    </div>
                  ) : null}
                  {agent === "streaming" ? null : (
                    <div
                      data-cursor-target="agentInput"
                      className={`relative flex h-8 items-center gap-2 rounded-md border border-input bg-transparent pr-1 pl-2.5 dark:bg-input/30 ${
                        agent === "review" ? "mt-1.5" : "border-foreground/20"
                      }`}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${
                          agent === "prompt" && chars
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {agent === "review"
                          ? "Ask a follow-up…"
                          : chars
                            ? AGENT_PROMPT.slice(0, chars)
                            : "Ask AI to write anything…"}
                      </span>
                      <Button
                        type="button"
                        variant="default"
                        size="icon-xs"
                        tabIndex={-1}
                        disabled={agent !== "prompt" || !chars}
                      >
                        <ArrowUpIcon />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const CAPTION_CLASS =
  "absolute bottom-0 left-0 w-max max-w-[19rem] text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.35] font-[550] tracking-[-0.025em] text-[color-mix(in_oklch,var(--foreground)_78%,transparent)]";

export function AuthCanvasPreview({ caption }: { caption?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Point[]>([]);
  const [armed, setArmed] = useState(false);
  const [typing, setTyping] = useState(false);
  const [wide, setWide] = useState(true);
  const [leaving, setLeaving] = useState<FolderKey | null>(insideFolder);
  const [leavingOpen, setLeavingOpen] = useState(true);
  const filterRef = useRef<HTMLDivElement>(null);
  // Where the controls in the panel's chrome are, measured once laid out.
  const [chromeTargets, setChromeTargets] = useState<
    Record<ChromeTarget, Point>
  >({
    swatch: { x: 190, y: 72 },
    matchNext: { x: 470, y: 72 },
    filterClear: { x: 510, y: 72 },
    agentInput: { x: 560, y: 200 },
    agentKeep: { x: 720, y: 260 },
  });
  const arrowBend = useMotionValue(0);
  const setFilterBarOpen = useSessionStore((store) => store.setFilterBarOpen);
  const toggleColor = useSessionStore((store) => store.toggleColor);
  const clearColors = useSessionStore((store) => store.clearColors);
  const arrowProgress = useMotionValue(0);
  const arrowPath = useTransform(
    [arrowProgress, arrowBend],
    ([progress, bend]: number[]) => {
      if (progress < 0.03) return "";
      const end = {
        x: ARROW_FROM.x + (ARROW_TO.x - ARROW_FROM.x) * progress,
        y: ARROW_FROM.y + (ARROW_TO.y - ARROW_FROM.y) * progress,
      };
      // Dragging the middle adds a point, and the arrow curves through it.
      return bend < 0.02
        ? makeArrowPaths("auth-arrow", [ARROW_FROM, end], "clean", "straight")
            .primary
        : makeArrowPaths(
            "auth-arrow",
            [
              ARROW_FROM,
              {
                x: ARROW_MID.x + ARROW_BEND.x * bend,
                y: ARROW_MID.y + ARROW_BEND.y * bend,
              },
              end,
            ],
            "clean",
            "smooth",
          ).primary;
    },
  );
  // A view that mounts after another fast-forwards to the next checkpoint.
  const [phase, setPhase] = useState(() =>
    clock.started ? nextCheckpoint(clock.position) : 0,
  );
  const frame = FRAMES[phase];

  useEffect(() => {
    clock.position = phase;
    clock.started = true;
  }, [phase]);

  const initial = lastCamera ?? frame.cam;
  const cameraX = useMotionValue(initial.x);
  const cameraY = useMotionValue(initial.y);
  const cameraScale = useMotionValue(initial.scale);
  // The panel's size relative to the one the camera poses were framed for.
  // Plain state on its own wrapper, so a resize can never disturb the camera.
  const [size, setSize] = useState({ w: 800, h: 700 });
  const fit = Math.min(1.5, Math.max(0.55, size.w / 800));
  const transform = useTransform(
    [cameraX, cameraY, cameraScale],
    ([x, y, zoom]: number[]) =>
      `translate3d(${-x * zoom}px, ${-y * zoom}px, 0) scale(${zoom})`,
  );

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () =>
      setSize({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Glide to wherever the timeline's camera is now.
  const cam = frame.cam;
  useEffect(() => {
    if (reduceMotion) {
      cameraX.set(cam.x);
      cameraY.set(cam.y);
      cameraScale.set(cam.scale);
      return;
    }
    const options = { duration: 0.75, ease: CAMERA_EASE };
    const controls = [
      animate(cameraX, cam.x, options),
      animate(cameraY, cam.y, options),
      animate(cameraScale, cam.scale, options),
    ];
    return () => {
      for (const control of controls) control.stop();
    };
  }, [cam, reduceMotion, cameraX, cameraY, cameraScale]);

  // Keep the shared pose current as the camera moves. The next view renders
  // before this one unmounts, so it has to be readable at all times.
  useEffect(() => {
    const save = () => {
      lastCamera = {
        x: cameraX.get(),
        y: cameraY.get(),
        scale: cameraScale.get(),
      };
    };
    save();
    const stops = [
      cameraX.on("change", save),
      cameraY.on("change", save),
      cameraScale.on("change", save),
    ];
    return () => {
      for (const stopListening of stops) stopListening();
    };
  }, [cameraX, cameraY, cameraScale]);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => setArmed(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  // Only play on screens that show the panel.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 48rem)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Hold still while someone is typing in the form.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        !target.closest("input, textarea")
      ) {
        return;
      }
      setTyping(true);
      clearTimeout(timer);
      timer = setTimeout(() => setTyping(false), TYPING_PAUSE_MS);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, []);

  const active = wide && !reduceMotion && !typing && armed;

  // Play the timeline, one step after another, forever.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(
      () => setPhase((current) => (current + 1) % FRAMES.length),
      frame.ms,
    );
    return () => clearTimeout(timer);
  }, [active, frame]);

  // Close a folder inherited from the previous view as the camera pulls back.
  useEffect(() => {
    if (!leaving) return;
    const raf = requestAnimationFrame(() => setLeavingOpen(false));
    const timer = setTimeout(() => setLeaving(null), 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [leaving]);

  // Let the next view know whether a folder is open right now.
  useEffect(() => {
    insideFolder = frame.inside;
  }, [frame.inside]);

  // Hovering shows what a visitor's pointer would: a colour offers "Copy hex",
  // a folder fans out its stack. That state is internal to the cards, so
  // replay the pointer events.
  const hover = active ? frame.hover : null;
  useEffect(() => {
    if (!hover) return;
    const card = worldRef.current?.querySelector(
      `[data-hover="${hover}"]`,
    )?.firstElementChild;
    if (!card) return;
    card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return () => {
      card.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    };
  }, [hover]);

  // Find the checkboxes the cursor ticks.
  useEffect(() => {
    const timer = setTimeout(() => {
      const world = worldRef.current;
      const note = noteRef.current;
      if (!world || !note) return;
      const found = [...note.querySelectorAll<HTMLElement>('[role="checkbox"]')]
        .slice(1)
        .map((element) => {
          const origin = offsetWithin(element, world);
          return {
            x: origin.x + element.offsetWidth / 2,
            y: origin.y + element.offsetHeight / 2,
          };
        });
      if (found.length >= 2) setBoxes(found);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Drive the app's real filter bar from the timeline. It reads the session
  // store, under a scope of its own so no real board is affected.
  useEffect(() => {
    setFilterBarOpen(FILTER_SCOPE, frame.filterOpen);
  }, [frame.filterOpen, setFilterBarOpen]);

  useEffect(() => {
    const selected =
      useSessionStore.getState().filterBars[FILTER_SCOPE]?.selectedColors ?? [];
    if (!frame.searchColor) {
      if (selected.length) clearColors(FILTER_SCOPE);
    } else if (!selected.includes(SEARCH_COLOR)) {
      toggleColor(FILTER_SCOPE, SEARCH_COLOR);
    }
  }, [frame.searchColor, clearColors, toggleColor]);

  useEffect(
    () => () => {
      clearColors(FILTER_SCOPE);
      setFilterBarOpen(FILTER_SCOPE, false);
    },
    [clearColors, setFilterBarOpen],
  );

  // The chrome animates as things open and close, so find its controls again
  // shortly after every step.
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const origin = container.getBoundingClientRect();
      const centre = (selector: string) => {
        const element = container.querySelector(selector);
        if (!element) return undefined;
        const rect = element.getBoundingClientRect();
        if (!rect.width) return undefined;
        return {
          x: rect.left - origin.left + rect.width / 2,
          y: rect.top - origin.top + rect.height / 2,
        };
      };
      const marked = (name: ChromeTarget) =>
        centre(`[data-cursor-target="${name}"]`);
      setChromeTargets((current) => ({
        swatch: centre('[aria-label="Orange"]') ?? current.swatch,
        matchNext: centre('[aria-label="Next match"]') ?? current.matchNext,
        filterClear:
          centre('[aria-label="Clear all filters"]') ?? current.filterClear,
        agentInput: marked("agentInput") ?? current.agentInput,
        agentKeep: marked("agentKeep") ?? current.agentKeep,
      }));
    };
    const timers = [setTimeout(measure, 80), setTimeout(measure, 340)];
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [phase]);

  const resolve = (to: CursorTarget): Point =>
    to === "box0"
      ? (boxes[0] ?? FALLBACK_BOXES[0])
      : to === "box1"
        ? (boxes[1] ?? FALLBACK_BOXES[1])
        : to === "crumb"
          ? CRUMB_TARGET
          : typeof to === "string"
            ? chromeTargets[to]
            : to;

  // The "Copy hex" badge lights up under the cursor. Its hover is plain CSS,
  // which a scripted cursor cannot trigger, so the same look is set directly.
  const pillHot = frame.pillHot;
  useEffect(() => {
    if (!pillHot) return;
    const pill = worldRef.current?.querySelector(
      '[data-hover="clay"] button[aria-label="Copy hex color"]',
    );
    if (!pill) return;
    const classes = PILL_HOVER_CLASS.split(" ");
    pill.classList.add(...classes);
    return () => pill.classList.remove(...classes);
  }, [pillHot]);

  // Pulling the arrow's middle bends it.
  useEffect(() => {
    if (!frame.arrowBent || reduceMotion) {
      arrowBend.set(frame.arrowBent ? 1 : 0);
      return;
    }
    const control = animate(arrowBend, 1, { duration: 0.5, ease: MOVE_EASE });
    return () => control.stop();
  }, [frame.arrowBent, reduceMotion, arrowBend]);

  // The arrow grows from its start as the cursor drags, like drawing it.
  useEffect(() => {
    if (!frame.arrow || reduceMotion) {
      arrowProgress.set(frame.arrow ? 1 : 0);
      return;
    }
    const control = animate(arrowProgress, 1, {
      duration: 0.5,
      ease: MOVE_EASE,
    });
    return () => control.stop();
  }, [frame.arrow, reduceMotion, arrowProgress]);

  const lamp = DRAG_POSES[frame.lamp];
  const lighting = useMemo(() => lightingNote(frame.ticked), [frame.ticked]);
  const folder = useMemo(
    () => lightingFolder(frame.filed, frame.lightingAdded),
    [frame.filed, frame.lightingAdded],
  );
  const furniture = useMemo(
    () => furnitureFolder(frame.furnitureAdded),
    [frame.furnitureAdded],
  );

  // Leaving a folder, the cursor travels in screen space to the parent crumb.
  // While hidden it waits roughly where the cursor inside the folder was.
  const screenPoint =
    !frame.screen.visible && frame.inside
      ? { x: size.w * 0.5, y: size.h * 0.44 + 160 * fit * 0.85 }
      : resolve(frame.screen.to);

  const textStyle = canvasTextTypography("sue_ellen_francisco", "md");

  // Colour search: everything but the matching images is dimmed, and the
  // match in focus is outlined, with the canvas.s own styling.
  const searched = frame.searchColor && !frame.searching;
  const dimmed = searched ? DIM_CLASS : "";
  const focused = (index: number) => (frame.focus === index ? FOCUS_CLASS : "");

  const crumbFolder = leaving && !frame.inside ? leaving : frame.mounted;
  const crumbInside =
    frame.inside !== null || (leaving !== null && leavingOpen);
  const lines = CHAPTER_CAPTIONS[frame.chapter];

  return (
    <>
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        inert
      >
        <div className={`${AUTH_TILTED_PLANE} absolute inset-0`}>
          {/* Fades out for the cut where the loop starts over. */}
          <motion.div
            className="absolute top-[44%] left-[50%] size-0"
            style={{ transform: `scale(${fit})`, transformOrigin: "0 0" }}
            initial={false}
            animate={{ opacity: frame.dip ? 0 : 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <motion.div
              className="absolute top-0 left-0 size-0 will-change-transform"
              style={{ transform, transformOrigin: "0 0" }}
            >
              <div className="absolute -top-[4000px] -left-[4000px] h-[9000px] w-[9000px] bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_17%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]" />
              <div ref={worldRef} className="absolute top-0 left-0">
                <Placed
                  box={LAYOUT.lamp}
                  className={`z-[30] ${dimmed}`}
                  animate={{
                    y: lamp.y,
                    scale: lamp.scale,
                    rotate: lamp.rotate,
                    opacity: lamp.opacity,
                    filter: lamp.lift ? LIFT_SHADOW : NO_SHADOW,
                  }}
                  transition={{
                    duration: DRAG_DURATIONS[frame.lamp],
                    ease: MOVE_EASE,
                  }}
                >
                  <ImageAssetCard asset={IMAGES.lamp} />
                </Placed>

                <Placed
                  box={LAYOUT.lightingFolder}
                  data-hover="lighting"
                  className={dimmed}
                >
                  <FolderAssetCard
                    asset={folder}
                    isDropTarget={frame.dropTarget}
                    incomingAssetId={
                      frame.filed ? "auth-folder-incoming" : undefined
                    }
                  />
                </Placed>
                <Placed
                  box={LAYOUT.furnitureFolder}
                  data-hover="furniture"
                  className={dimmed}
                >
                  <FolderAssetCard asset={furniture} />
                </Placed>

                <Placed box={LAYOUT.link} className={dimmed}>
                  <LinkAssetCard asset={LINK} />
                </Placed>
                <div
                  ref={noteRef}
                  className={`absolute ${CARD_SHADOW} ${dimmed}`}
                  style={{
                    left: LAYOUT.lightingNote.x,
                    top: LAYOUT.lightingNote.y,
                    width: LAYOUT.lightingNote.w,
                  }}
                >
                  <NoteAssetCard asset={lighting} />
                </div>

                <Placed box={LAYOUT.room} className={focused(1)}>
                  <ImageAssetCard asset={IMAGES.room} />
                </Placed>
                <Placed box={LAYOUT.chair} className={focused(0)}>
                  <ImageAssetCard asset={IMAGES.chair} />
                </Placed>
                <Placed box={LAYOUT.clay} data-hover="clay" className={dimmed}>
                  <ColorAssetCard asset={COLORS[0]} />
                </Placed>
                <Placed box={LAYOUT.plaster} className={dimmed}>
                  <ColorAssetCard asset={COLORS[1]} />
                </Placed>
                <Placed box={LAYOUT.moss} className={dimmed}>
                  <ColorAssetCard asset={COLORS[2]} />
                </Placed>
                <Placed
                  box={LAYOUT.wallNote}
                  className={`z-[20] ${dimmed}`}
                  animate={{
                    x: frame.noteMoved ? NOTE_MOVE.x : 0,
                    y: frame.noteMoved ? NOTE_MOVE.y : 0,
                    scale: frame.noteLift ? 1.04 : 1,
                    rotate: frame.noteLift ? -1.5 : 0,
                    filter: frame.noteLift ? LIFT_SHADOW : NO_SHADOW,
                  }}
                  transition={{ duration: 0.6, ease: MOVE_EASE }}
                >
                  <NoteAssetCard asset={WALL_NOTE} />
                </Placed>
                <Placed box={LAYOUT.swatches} className={dimmed}>
                  <ImageAssetCard asset={IMAGES.swatches} />
                </Placed>

                {POOL.map((item, index) => (
                  // Each card waits for the cursor to land before appearing.
                  <Placed
                    key={item.key}
                    box={item.box}
                    className={dimmed}
                    {...arrive(index < frame.pasted, 0.3)}
                  >
                    {item.kind === "image" ? (
                      <ImageAssetCard asset={item.asset} />
                    ) : item.kind === "video" ? (
                      <VideoAssetCard asset={item.asset} />
                    ) : (
                      <LinkAssetCard asset={item.asset} />
                    )}
                  </Placed>
                ))}

                {/* A label made with the text tool, as the canvas draws one. */}
                <div
                  className="absolute inline-block min-h-7 rounded-sm px-2 py-1.5"
                  style={{
                    left: TEXT_AT.x,
                    top: TEXT_AT.y,
                    color: "var(--foreground)",
                    opacity: frame.textEditing || frame.textChars ? 1 : 0,
                  }}
                >
                  <p
                    className={`whitespace-pre ${textStyle.className}`}
                    style={textStyle.style}
                  >
                    {CANVAS_TEXT.slice(0, frame.textChars)}
                    {frame.textEditing ? (
                      <span className="ml-px inline-block h-[0.9em] w-px translate-y-[0.12em] animate-pulse bg-current" />
                    ) : null}
                  </p>
                </div>

                {/* An arrow from the arrow tool, built with the app's geometry. */}
                <svg
                  className="absolute top-0 left-0 overflow-visible"
                  width="1"
                  height="1"
                  style={{ color: "var(--foreground)" }}
                >
                  <defs>
                    <marker
                      id="auth-canvas-arrowhead"
                      markerWidth="9"
                      markerHeight="9"
                      refX="8"
                      refY="4"
                      orient="auto"
                      markerUnits="strokeWidth"
                      overflow="visible"
                    >
                      <path
                        d="M 0.75 0.75 L 8 4 L 0.75 7.25"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </marker>
                  </defs>
                  <motion.path
                    d={arrowPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd="url(#auth-canvas-arrowhead)"
                  />
                </svg>

                <Cursor
                  point={resolve(frame.world.to)}
                  state={frame.world}
                  parentScale={cam.scale * fit}
                  tool={frame.tool}
                />
              </div>
            </motion.div>
          </motion.div>
        </div>

        {leaving ? (
          <FolderBoard
            key={`leaving-${leaving}`}
            folder={leaving}
            hasLamp={leaving === "lighting"}
            open={leavingOpen}
            fit={fit}
            pasted
            moved
            lift={false}
          />
        ) : null}
        <FolderBoard
          key={frame.mounted}
          folder={frame.mounted}
          hasLamp={frame.filed}
          open={frame.inside === frame.mounted}
          fit={fit}
          pasted={
            frame.mounted === "lighting"
              ? frame.lightingAdded
              : frame.furnitureAdded
          }
          moved={frame.innerMoved}
          lift={frame.innerLift}
          cursor={{ point: resolve(frame.inner.to), state: frame.inner }}
          noteExtra={frame.agent === "kept" ? AGENT_NOTE_EXTRA : ""}
          grid={frame.gridView}
        />

        <Breadcrumb
          folder={crumbFolder}
          inside={crumbInside}
          hot={frame.crumbHot}
        />
        <KeyHint show={frame.keyHint} />
        <NoteSheet
          open={frame.noteOpen}
          agent={frame.agent}
          chars={frame.agentChars}
          lines={frame.agentOut}
        />
        {/* The app's own filter bar, sitting just under the breadcrumb. */}
        <div ref={filterRef} className="absolute inset-x-0 top-10 z-[3]">
          <FilterBar
            scope={FILTER_SCOPE}
            searchStatus={{
              resultCount: searched ? SEARCH_MATCHES.length : undefined,
              isSearching: frame.searching,
              focusedResultIndex: frame.focus,
              onPrevious: noop,
              onNext: noop,
            }}
          />
        </div>

        <Cursor point={screenPoint} state={frame.screen} parentScale={1} />

        {/* What the app's own toast says after "Copy hex". */}
        <motion.div
          className="absolute top-4 right-4 z-[3] flex items-center gap-2 rounded-[var(--radius)] border border-border bg-popover px-3 py-2 text-[13px] font-medium text-popover-foreground shadow-md"
          initial={false}
          animate={{
            opacity: frame.toast ? 1 : 0,
            y: frame.toast ? 0 : -12,
          }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <CircleCheckIcon className="size-4" />
          Copied color.
        </motion.div>
      </div>

      <div className="absolute bottom-[clamp(1.5rem,4vw,3rem)] left-[clamp(1.5rem,4vw,3rem)] z-[3]">
        {caption ? (
          <p className={CAPTION_CLASS}>{caption}</p>
        ) : (
          <AnimatePresence initial={false}>
            <motion.p
              key={frame.chapter}
              className={CAPTION_CLASS}
              initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {lines[0]}
              <br />
              {lines[1]}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}
