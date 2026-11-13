import { FolderIcon } from "lucide-react";
import {
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

import { AUTH_TILTED_PLANE } from "../auth-tilted-plane";
import {
  CAMERA_STOPS,
  COLORS,
  FOLDER_FOCUS,
  FOLDER_NAMES,
  FURNITURE_FOLDER,
  IMAGES,
  LAYOUT,
  LINK,
  POOL,
  WALL_NOTE,
  innerBoard,
  lightingFolder,
  lightingNote,
  type AuthCanvasStop,
  type FolderKey,
} from "./auth-canvas-scene";

/**
 * What the board has gained so far. Nothing on the canvas is ever removed to
 * be shown again: pasted cards stay, the filed card stays in its folder and
 * ticked items stay ticked. Progress is recorded the moment it happens, so
 * changing views mid-action never takes anything back: the next view picks the
 * board up exactly as it is. Once a stop has used up its own action it falls
 * back to opening a folder, which leaves the board exactly as it found it.
 * Module state, so it survives the panel remounting on each route.
 */
interface Memory {
  /** How many pool cards have been pasted in. */
  pasted: number;
  filed: boolean;
  /** How many of the checklist's two open items are ticked. */
  ticked: number;
}
const memory: Memory = { pasted: 0, filed: false, ticked: 0 };

type ScriptKind = "paste" | "file" | "tick" | "open";

interface Script {
  kind: ScriptKind;
  durations: number[];
  /** Paste: the pool cards coming in. */
  items?: number[];
  /** Tick: how many items were already ticked when it started. */
  from?: number;
  /** Open: which folder. */
  folder?: FolderKey;
}

/** Phase lengths in ms. Each script rests on its last phase, then loops. */
function resolveScript(stop: AuthCanvasStop, mem: Memory): Script {
  if (stop === "capture" && mem.pasted < POOL.length) {
    const items = [mem.pasted, mem.pasted + 1].filter(
      (index) => index < POOL.length,
    );
    // approach, first card, (move on, second card)
    return {
      kind: "paste",
      items,
      durations: items.length === 2 ? [250, 900, 500, 1700] : [250, 2000],
    };
  }
  if (stop === "organize" && !mem.filed) {
    // idle, grab, drag, hover the folder, drop, rest
    return { kind: "file", durations: [350, 200, 500, 200, 350, 1600] };
  }
  if (stop === "write" && mem.ticked < 2) {
    // idle, (first box, ticked,) second box, ticked, leave
    return mem.ticked === 0
      ? { kind: "tick", from: 0, durations: [250, 450, 650, 450, 1400, 400] }
      : { kind: "tick", from: 1, durations: [250, 450, 1500, 400] };
  }
  // approach, move, press, zoom in, step inside, reach for a note, drag it,
  // let go, zoom out, rest
  return {
    kind: "open",
    folder: stop === "overview" ? "furniture" : "lighting",
    durations: [250, 450, 200, 650, 350, 500, 700, 700, 650, 500],
  };
}

const CAMERA_EASE = [0.65, 0, 0.35, 1] as const;
const MOVE_EASE = [0.45, 0, 0.2, 1] as const;
// How long a new view waits before its script starts.
const SETTLE_MS = 120;
// A key press inside the form pauses the script for this long.
const TYPING_PAUSE_MS = 2500;

const CARD_SHADOW =
  "[&>*]:shadow-[0_0.5rem_1rem_-0.75rem_color-mix(in_oklch,var(--foreground)_14%,transparent)]";

interface Point {
  x: number;
  y: number;
}

const FALLBACK_BOXES: Point[] = [
  { x: 337, y: 410 },
  { x: 337, y: 432 },
];

// Survives the panel remounting on each route, so the camera glides from
// where the last view left it.
let lastCamera: { x: number; y: number; scale: number } | undefined;

// The folder a visitor is currently looking inside, if any. A view that mounts
// while one is open starts with it open and closes it as the camera pulls back,
// so changing views mid-animation reads as one continuous move.
let insideFolder: FolderKey | null = null;

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
    transition: { duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] as const },
  };
}

const FOLDER_CENTERS: Record<FolderKey, Point> = {
  lighting: { x: 160, y: 501 },
  furniture: { x: 160, y: 773 },
};

function slotPoint(index: number): Point {
  const box = POOL[index].box;
  return { x: box.x + box.w / 2, y: box.y + 90 };
}

interface CursorPose extends Point {
  opacity: number;
  scale: number;
}

function cursorPose(script: Script, phase: number, boxes: Point[]): CursorPose {
  const at = (point: Point, scale = 1, opacity = 1) => ({
    ...point,
    opacity,
    scale,
  });

  if (script.kind === "paste") {
    const items = script.items ?? [0];
    const target = slotPoint(items[Math.min(items.length - 1, phase >> 1)]);
    if (phase === 0) return at({ x: target.x - 70, y: target.y - 50 });
    return at(target);
  }

  if (script.kind === "file") {
    if (phase === 0) return at({ x: 160, y: 200 });
    if (phase === 1) return at({ x: 160, y: 200 }, 0.88);
    return {
      x: 160,
      y: 500,
      opacity: phase >= 5 ? 0 : 1,
      scale: phase >= 4 ? 1 : 0.88,
    };
  }

  if (script.kind === "tick") {
    const start = { x: 590, y: 380 };
    const first = boxes[0] ?? FALLBACK_BOXES[0];
    const second = boxes[1] ?? FALLBACK_BOXES[1];
    if (script.from === 1) {
      // only the second item is left: idle, move, ticked, leave
      if (phase === 0) return at(start);
      if (phase <= 2) return at(second);
      return at(start, 1, 0);
    }
    if (phase === 0) return at(start);
    if (phase <= 2) return at(first);
    if (phase <= 4) return at(second);
    return at(start, 1, 0);
  }

  const center = FOLDER_CENTERS[script.folder ?? "lighting"];
  if (phase === 0) return at({ x: center.x + 260, y: center.y + 40 });
  if (phase === 2) return at(center, 0.88);
  if (phase >= 4 && phase <= 7) return at(center, 1, 0);
  if (phase === 9) return at(center, 1, 0);
  return at(center);
}

const DRAG_POSES = [
  { y: 0, scale: 1, rotate: 0, opacity: 1, lift: false },
  { y: 0, scale: 1.04, rotate: -1.5, opacity: 1, lift: true },
  { y: 290, scale: 0.92, rotate: -1.5, opacity: 1, lift: true },
  { y: 290, scale: 0.92, rotate: -1.5, opacity: 1, lift: true },
  { y: 320, scale: 0.4, rotate: 0, opacity: 0, lift: false },
  { y: 320, scale: 0.4, rotate: 0, opacity: 0, lift: false },
];
const DRAG_DURATIONS = [0.3, 0.2, 0.5, 0.15, 0.25, 0.25];

function Cursor({
  script,
  phase,
  boxes,
  zoom,
}: {
  script: Script;
  phase: number;
  boxes: Point[];
  /** The camera's on-screen scale, so the cursor keeps one size at every zoom. */
  zoom: number;
}) {
  const pose = cursorPose(script, phase, boxes);
  return (
    <motion.div
      aria-hidden="true"
      className="absolute top-0 left-0 z-[40]"
      initial={false}
      animate={pose}
      transition={{ duration: 0.5, ease: MOVE_EASE }}
    >
      <motion.div
        initial={false}
        animate={{ scale: 1 / zoom }}
        transition={{ duration: 0.7, ease: CAMERA_EASE }}
        style={{ transformOrigin: "3px 2px" }}
      >
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
  phase = 4,
}: {
  folder: FolderKey;
  hasLamp: boolean;
  open: boolean;
  fit: number;
  /** The open script's phase: 5 reaches for the note, 6 drags it, 7 lets go. */
  phase?: number;
}) {
  const cards = useMemo(() => innerBoard(folder, hasLamp), [folder, hasLamp]);
  const dragging = phase === 6;
  const moved = phase >= 6 && phase <= 7;
  // The note's centre before and after it is dragged down a slot.
  const rest = { x: 0, y: -30 };
  const cursor =
    phase === 4
      ? { x: 300, y: 160, opacity: 1 }
      : phase === 5
        ? { ...rest, opacity: 1 }
        : phase === 6 || phase === 7
          ? { x: rest.x, y: rest.y + 190, opacity: 1 }
          : { x: 300, y: 160, opacity: 0 };
  return (
    <>
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
            style={{
              transform: `scale(${fit * 0.85})`,
              transformOrigin: "0 0",
            }}
          >
            {cards.map((card) => {
              const isNote = card.asset.type === "note";
              return (
                <motion.div
                  key={card.key}
                  className={`absolute ${CARD_SHADOW} ${isNote ? "z-[30]" : ""}`}
                  style={{ left: card.x, top: card.y, width: 240 }}
                  initial={false}
                  animate={
                    isNote
                      ? {
                          y: moved ? 190 : 0,
                          scale: dragging ? 1.04 : 1,
                          rotate: dragging ? -1.5 : 0,
                          filter: dragging
                            ? "drop-shadow(0 18px 14px rgb(0 0 0 / 0.2))"
                            : "drop-shadow(0 0 0 rgb(0 0 0 / 0))",
                        }
                      : undefined
                  }
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
              aria-hidden="true"
              className="absolute top-0 left-0 z-[40]"
              initial={false}
              animate={cursor}
              transition={{ duration: 0.5, ease: MOVE_EASE }}
            >
              <div
                style={{
                  transform: `scale(${1 / (fit * 0.85)})`,
                  transformOrigin: "3px 2px",
                }}
              >
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
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
      <motion.div
        className="absolute top-4 left-4 z-[3] flex items-center gap-1.5 rounded-lg border border-border bg-sidebar/85 px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm"
        initial={false}
        animate={{ opacity: open ? 1 : 0, y: open ? 0 : -4 }}
        transition={{ duration: 0.2, delay: open ? 0.1 : 0 }}
      >
        <span className="text-sidebar-foreground/55">Studio refresh</span>
        <span className="text-sidebar-foreground/30">/</span>
        <FolderIcon className="size-3.5" strokeWidth={1.75} />
        {FOLDER_NAMES[folder]}
      </motion.div>
    </>
  );
}

export function AuthCanvasPreview({
  stop = "overview",
}: {
  stop?: AuthCanvasStop;
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Point[]>([]);
  const [armedStop, setArmedStop] = useState<AuthCanvasStop | null>(null);
  const [typing, setTyping] = useState(false);
  const [wide, setWide] = useState(true);
  const [board, setBoard] = useState<Memory>({ ...memory });
  const [leaving, setLeaving] = useState<FolderKey | null>(insideFolder);
  const [leavingOpen, setLeavingOpen] = useState(true);
  const [state, setState] = useState(() => ({
    stop,
    script: resolveScript(stop, memory),
    phase: 0,
  }));

  // Start the new view's script from the top.
  if (state.stop !== stop) {
    setState({ stop, script: resolveScript(stop, memory), phase: 0 });
  }
  const { script, phase } = state;

  const folderOpen = script.kind === "open" && phase >= 3 && phase <= 7;
  const focus = folderOpen ? FOLDER_FOCUS[script.folder ?? "lighting"] : null;
  const focusKey = folderOpen ? script.folder : undefined;

  const initial = lastCamera ?? CAMERA_STOPS[stop];
  const cameraX = useMotionValue(initial.x);
  const cameraY = useMotionValue(initial.y);
  const cameraScale = useMotionValue(initial.scale);
  // The panel's size relative to the one the stops were framed for. Plain
  // state on its own wrapper, so a resize can never disturb the camera.
  const [fit, setFit] = useState(1);
  const transform = useTransform(
    [cameraX, cameraY, cameraScale],
    ([x, y, zoom]: number[]) =>
      `translate3d(${-x * zoom}px, ${-y * zoom}px, 0) scale(${zoom})`,
  );

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () =>
      setFit(Math.min(1.5, Math.max(0.55, element.clientWidth / 800)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Glide to this view's stop, or into the folder being opened.
  useEffect(() => {
    const target = focusKey ? FOLDER_FOCUS[focusKey] : CAMERA_STOPS[stop];

    if (reduceMotion) {
      cameraX.set(target.x);
      cameraY.set(target.y);
      cameraScale.set(target.scale);
      return;
    }

    const options = { duration: focusKey ? 0.7 : 0.8, ease: CAMERA_EASE };
    const controls = [
      animate(cameraX, target.x, options),
      animate(cameraY, target.y, options),
      animate(cameraScale, target.scale, options),
    ];
    return () => {
      for (const control of controls) control.stop();
    };
  }, [stop, focusKey, reduceMotion, cameraX, cameraY, cameraScale]);

  // The script starts almost as soon as a view arrives, while the camera is
  // still on its way.
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => setArmedStop(stop), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [stop, reduceMotion]);

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

  const active = wide && !reduceMotion && !typing && armedStop === stop;

  // Advance the script; on wrapping, pick the next one from what is left.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setState((current) => {
        if (current.phase < current.script.durations.length - 1) {
          return { ...current, phase: current.phase + 1 };
        }
        return {
          stop: current.stop,
          script: resolveScript(current.stop, memory),
          phase: 0,
        };
      });
    }, script.durations[phase]);
    return () => clearTimeout(timer);
  }, [active, script, phase]);

  // Whatever a script adds is kept from the moment it appears, so leaving
  // mid-action never takes it back.
  useEffect(() => {
    const before = { ...memory };
    if (script.kind === "paste") {
      const items = script.items ?? [];
      const shown = items.filter((_, slot) => phase >= 1 + slot * 2).length;
      if (shown) memory.pasted = Math.max(memory.pasted, items[0] + shown);
    } else if (script.kind === "file") {
      if (phase >= 4) memory.filed = true;
    } else if (script.kind === "tick") {
      const first = script.from ?? 0;
      const done =
        first === 1
          ? phase >= 2
            ? 2
            : 1
          : phase >= 4
            ? 2
            : phase >= 2
              ? 1
              : 0;
      memory.ticked = Math.max(memory.ticked, done);
    }
    if (
      before.pasted !== memory.pasted ||
      before.filed !== memory.filed ||
      before.ticked !== memory.ticked
    ) {
      setBoard({ ...memory });
    }
  }, [phase, script]);

  // Close a folder inherited from the previous view as the camera pulls back.
  useEffect(() => {
    if (!leaving) return;
    const frame = requestAnimationFrame(() => setLeavingOpen(false));
    const timer = setTimeout(() => setLeaving(null), 500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [leaving]);

  // Let the next view know whether a folder is open right now.
  const inside =
    script.kind === "open" && phase >= 4 && phase <= 7 ? script.folder : null;
  useEffect(() => {
    insideFolder = inside ?? null;
  }, [inside]);

  // Show a folder what a visitor's pointer would: it fans out its stack.
  useEffect(() => {
    if (script.kind !== "open" || !active || phase < 2 || phase > 8) return;
    const card = worldRef.current?.querySelector(
      `[data-hover="${script.folder}"]`,
    )?.firstElementChild;
    if (!card) return;
    card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return () => {
      card.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    };
  }, [script, active, phase]);

  // Find the checkboxes the tick script clicks.
  useLayoutEffect(() => {
    if (script.kind !== "tick" || armedStop !== stop) return;
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
  }, [script.kind, armedStop, stop]);

  // What each card looks like right now.
  const pasting = script.kind === "paste";
  const poolVisible = (index: number) => {
    if (index < board.pasted) return true;
    if (!pasting) return false;
    const slot = (script.items ?? []).indexOf(index);
    return slot >= 0 && phase >= 1 + slot * 2;
  };

  const filing = script.kind === "file";
  const lampFiled = board.filed || (filing && phase >= 4);
  const dragPose = filing
    ? DRAG_POSES[phase]
    : board.filed
      ? DRAG_POSES[4]
      : DRAG_POSES[0];
  const dragDuration = filing ? DRAG_DURATIONS[phase] : 0.3;

  const ticked = board.ticked;

  const lighting = useMemo(() => lightingNote(ticked), [ticked]);
  const folder = useMemo(() => lightingFolder(lampFiled), [lampFiled]);

  const cursorZoom = (focus ?? CAMERA_STOPS[stop]).scale * fit;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1]"
      inert
    >
      <div className={`${AUTH_TILTED_PLANE} absolute inset-0`}>
        <div
          className="absolute top-[44%] left-[50%] size-0"
          style={{ transform: `scale(${fit})`, transformOrigin: "0 0" }}
        >
          <motion.div
            className="absolute top-0 left-0 size-0 will-change-transform"
            style={{ transform, transformOrigin: "0 0" }}
          >
            <div className="absolute -top-[4000px] -left-[4000px] h-[9000px] w-[9000px] bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_17%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div ref={worldRef} className="absolute top-0 left-0">
              <Placed
                box={LAYOUT.lamp}
                className="z-[30]"
                animate={{
                  y: dragPose.y,
                  scale: dragPose.scale,
                  rotate: dragPose.rotate,
                  opacity: dragPose.opacity,
                  filter: dragPose.lift
                    ? "drop-shadow(0 18px 14px rgb(0 0 0 / 0.2))"
                    : "drop-shadow(0 0 0 rgb(0 0 0 / 0))",
                }}
                transition={{ duration: dragDuration, ease: MOVE_EASE }}
              >
                <ImageAssetCard asset={IMAGES.lamp} />
              </Placed>

              <Placed box={LAYOUT.lightingFolder} data-hover="lighting">
                <FolderAssetCard
                  asset={folder}
                  isDropTarget={filing && phase === 3}
                  incomingAssetId={
                    lampFiled ? "auth-folder-incoming" : undefined
                  }
                />
              </Placed>
              <Placed box={LAYOUT.furnitureFolder} data-hover="furniture">
                <FolderAssetCard asset={FURNITURE_FOLDER} />
              </Placed>

              <Placed box={LAYOUT.link}>
                <LinkAssetCard asset={LINK} />
              </Placed>
              <div
                ref={noteRef}
                className={`absolute ${CARD_SHADOW}`}
                style={{
                  left: LAYOUT.lightingNote.x,
                  top: LAYOUT.lightingNote.y,
                  width: LAYOUT.lightingNote.w,
                }}
              >
                <NoteAssetCard asset={lighting} />
              </div>

              <Placed box={LAYOUT.room}>
                <ImageAssetCard asset={IMAGES.room} />
              </Placed>
              <Placed box={LAYOUT.chair}>
                <ImageAssetCard asset={IMAGES.chair} />
              </Placed>
              <Placed box={LAYOUT.clay}>
                <ColorAssetCard asset={COLORS[0]} />
              </Placed>
              <Placed box={LAYOUT.plaster}>
                <ColorAssetCard asset={COLORS[1]} />
              </Placed>
              <Placed box={LAYOUT.moss}>
                <ColorAssetCard asset={COLORS[2]} />
              </Placed>
              <Placed box={LAYOUT.wallNote}>
                <NoteAssetCard asset={WALL_NOTE} />
              </Placed>
              <Placed box={LAYOUT.swatches}>
                <ImageAssetCard asset={IMAGES.swatches} />
              </Placed>

              {POOL.map((item, index) => (
                <Placed
                  key={item.key}
                  box={item.box}
                  {...arrive(
                    poolVisible(index),
                    // The first card waits for the cursor to land.
                    script.items?.[0] === index ? 0.3 : 0,
                  )}
                >
                  {item.kind === "image" ? (
                    <ImageAssetCard asset={item.asset} />
                  ) : (
                    <LinkAssetCard asset={item.asset} />
                  )}
                </Placed>
              ))}

              <Cursor
                script={script}
                phase={phase}
                boxes={boxes}
                zoom={cursorZoom}
              />
            </div>
          </motion.div>
        </div>
      </div>
      {leaving ? (
        <FolderBoard
          key={`leaving-${leaving}`}
          folder={leaving}
          hasLamp={lampFiled}
          open={leavingOpen}
          fit={fit}
        />
      ) : null}
      {script.kind === "open" ? (
        <FolderBoard
          key={script.folder}
          folder={script.folder ?? "lighting"}
          hasLamp={lampFiled}
          open={phase >= 4 && phase <= 7}
          phase={phase}
          fit={fit}
        />
      ) : null}
    </div>
  );
}
