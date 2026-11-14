import {
  CAMERA_STOPS,
  FOLDER_FOCUS,
  INNER_PASTE_BOX,
  POOL,
  type CameraPose,
  type FolderKey,
} from "./auth-canvas-scene";

/**
 * One long, looping sequence of things a person does on a board. It is not
 * tied to any auth view: every view shows the same timeline, and switching
 * views simply carries on from the same step.
 *
 * The whole scene is a pure function of the step index (see FRAMES), so
 * jumping to any step is always consistent. Everything a step adds stays put
 * (a card pasted into a folder shows in that folder's stack afterwards) until
 * the loop ends, where the board dips out for a moment and starts over.
 */

export type ChapterId =
  | "collect"
  | "capture"
  | "write"
  | "organize"
  | "folders"
  | "arrange"
  | "search"
  | "annotate"
  | "browse";

/** Two short lines per chapter, naming what the board is showing. */
export const CHAPTER_CAPTIONS: Record<ChapterId, [string, string]> = {
  collect: ["Collect ideas and inspiration.", "Keep it all on one canvas."],
  capture: [
    "Paste a link or drop an image.",
    "It lands right where you point.",
  ],
  write: ["Keep notes next to references.", "Tick things off as you go."],
  organize: ["Drag cards into folders", "to keep each project together."],
  folders: ["Open a folder to see", "everything you filed in it."],
  arrange: ["Move anything, anywhere.", "Lay it out the way you think."],
  search: ["Search your board by colour.", "Step through every match."],
  annotate: ["Add text and arrows", "to say what you mean."],
  browse: ["A folder is a board of its own.", "Step in, then step back out."],
};

export interface Point {
  x: number;
  y: number;
}

/** A fixed point, or a spot the component measures at runtime. */
export type CursorTarget =
  | Point
  | "box0"
  | "box1"
  | "crumb"
  | "swatch"
  | "matchNext"
  | "filterClear"
  | "agentInput"
  | "agentKeep";

/** Where the agent is in a run: its prompt, writing, the draft in review, kept. */
export type AgentPhase = "off" | "prompt" | "streaming" | "review" | "kept";

export type CanvasTool = "select" | "text" | "arrow";

/** The cursor is drawn on the board, inside a folder, or over the chrome. */
type Space = "world" | "inner" | "screen";

interface CursorSpec {
  in: Space;
  to: CursorTarget;
  press?: boolean;
}

/** State that stays as set until a later step changes it. */
interface Sticky {
  /** How many pool cards have been pasted onto the board. */
  pasted: number;
  /** How many of the checklist's two open items are ticked. */
  ticked: number;
  /** The lamp photo is in the Lighting folder. */
  filed: boolean;
  /** The "Wall colours" note has been dragged to its new spot. */
  noteMoved: boolean;
  noteLift: boolean;
  /** The folder whose inside is showing, if any. */
  inside: FolderKey | null;
  /** The folder whose inside is mounted (hidden until entered). */
  mounted: FolderKey;
  /** A card was pasted into this folder; it shows in its stack from then on. */
  lightingAdded: boolean;
  furnitureAdded: boolean;
  innerMoved: boolean;
  /** The filter bar is open. */
  filterOpen: boolean;
  /** A colour is selected in it; the search is still running; the match in focus. */
  searchColor: boolean;
  searching: boolean;
  focus: number | null;
  /** The active canvas tool; it decides the cursor's shape. */
  tool: CanvasTool;
  /** How much of the canvas text has been typed, and whether it is being edited. */
  textChars: number;
  textEditing: boolean;
  /** The arrow has been drawn. */
  arrow: boolean;
  /** Its middle has been dragged out into a bend. */
  arrowBent: boolean;
  /** A note inside the folder is open, and what the agent is doing in it. */
  noteOpen: boolean;
  agent: AgentPhase;
  agentChars: number;
  agentOut: number;
  /** The grid shortcut.s keys are flashing; the folder is showing as a grid. */
  keyHint: boolean;
  gridView: boolean;
  /** The "Copied color." toast is showing. */
  toast: boolean;
}

interface Step {
  ms: number;
  /** Starts a chapter; view switches fast-forward to these. */
  checkpoint?: ChapterId;
  cam?: CameraPose;
  cursor?: CursorSpec;
  set?: Partial<Sticky>;
  /** Index into the lamp's drag poses, for this step only. */
  lamp?: number;
  dropTarget?: boolean;
  /** A card to hover for this step ("clay", or a folder). */
  hover?: string;
  innerLift?: boolean;
  crumbHot?: boolean;
  /** The cursor is over the colour card.s "Copy hex" badge. */
  pillHot?: boolean;
  /** The board is faded out: the cut where the loop starts over. */
  dip?: boolean;
}

export interface CursorState {
  to: CursorTarget;
  visible: boolean;
  press: boolean;
}

export interface Frame extends Sticky {
  ms: number;
  chapter: ChapterId;
  checkpoint: boolean;
  cam: CameraPose;
  world: CursorState;
  inner: CursorState;
  screen: CursorState;
  lamp: number;
  dropTarget: boolean;
  hover: string | null;
  innerLift: boolean;
  crumbHot: boolean;
  pillHot: boolean;
  dip: boolean;
}

const world = (x: number, y: number, press = false): CursorSpec => ({
  in: "world",
  to: { x, y },
  press,
});
const inner = (x: number, y: number, press = false): CursorSpec => ({
  in: "inner",
  to: { x, y },
  press,
});

const slot = (index: number): Point => {
  const box = POOL[index].box;
  return { x: box.x + box.w / 2, y: box.y + 90 };
};

const FOLDER_CENTERS: Record<FolderKey, Point> = {
  lighting: { x: 160, y: 501 },
  furniture: { x: 160, y: 773 },
};

const INNER_SLOT: Point = {
  x: INNER_PASTE_BOX.x + INNER_PASTE_BOX.w / 2,
  y: INNER_PASTE_BOX.y + 90,
};
/** The inner note's centre; it gets dragged 190px down. */
const INNER_NOTE: Point = { x: 30, y: 0 };
export const INNER_NOTE_DROP = 190;

/** Where the "Wall colours" note is dragged to, relative to its home. */
export const NOTE_MOVE: Point = { x: -544, y: 189 };

/** The label typed with the text tool, and where it sits on the board. */
export const CANVAS_TEXT = "Decide by Friday";
export const TEXT_AT: Point = { x: 872, y: 690 };
/** The arrow drawn from that label up to the "Warm white" colour card. */
export const ARROW_FROM: Point = { x: 958, y: 684 };
export const ARROW_TO: Point = { x: 974, y: 572 };
/** The colour picked in the filter bar, and the cards whose images match it. */
export const SEARCH_COLOR = "#f97316";
export const SEARCH_MATCHES = ["chair", "room"] as const;
const SEARCH_CAMS: CameraPose[] = [
  { x: 976, y: 170, scale: 1.05 },
  { x: 704, y: 170, scale: 1.05 },
];
/** The middle of the arrow, and how far it is dragged to bend it. */
export const ARROW_MID: Point = {
  x: (ARROW_FROM.x + ARROW_TO.x) / 2,
  y: (ARROW_FROM.y + ARROW_TO.y) / 2,
};
export const ARROW_BEND: Point = { x: 34, y: 4 };
const ANNOTATE_CAM: CameraPose = { x: 940, y: 600, scale: 1.05 };

const BOARD_START: Partial<Sticky> = {
  pasted: 0,
  ticked: 0,
  filed: false,
  noteMoved: false,
  noteLift: false,
  filterOpen: false,
  searchColor: false,
  searching: false,
  focus: null,
  tool: "select",
  textChars: 0,
  textEditing: false,
  arrow: false,
  arrowBent: false,
  noteOpen: false,
  agent: "off",
  agentChars: 0,
  agentOut: 0,
  keyHint: false,
  gridView: false,
};

/** What is asked of the agent in the open note, and what it writes back. */
export const AGENT_PROMPT = "What should I check before ordering?";
export const AGENT_LINES = [
  "Before ordering:",
  "The arm reaches past the desk edge",
  "The cord reaches the nearest socket",
  "The bulb dims at 2700K",
];

const NOTE_DROPPED: Point = {
  x: INNER_NOTE.x,
  y: INNER_NOTE.y + INNER_NOTE_DROP,
};

/**
 * Open the note, ask the agent on an empty line, watch it write, keep the
 * draft and close the note. The note card then shows what was added.
 */
const AGENT_STEPS: Step[] = [
  {
    ms: 250,
    cursor: inner(NOTE_DROPPED.x, NOTE_DROPPED.y, true),
    set: { noteOpen: true },
  },
  { ms: 550, cursor: { in: "screen", to: "agentInput" } },
  {
    ms: 200,
    cursor: { in: "screen", to: "agentInput", press: true },
    set: { agent: "prompt" },
  },
  {
    ms: 280,
    cursor: { in: "screen", to: "agentInput" },
    set: { agentChars: 9 },
  },
  { ms: 280, set: { agentChars: 22 } },
  { ms: 320, set: { agentChars: AGENT_PROMPT.length } },
  { ms: 350, set: { agent: "streaming" } },
  { ms: 300, set: { agentOut: 1 } },
  { ms: 300, set: { agentOut: 2 } },
  { ms: 300, set: { agentOut: 3 } },
  { ms: 350, set: { agentOut: 4 } },
  { ms: 450, set: { agent: "review" } },
  { ms: 500, cursor: { in: "screen", to: "agentKeep" } },
  {
    ms: 200,
    cursor: { in: "screen", to: "agentKeep", press: true },
    set: { agent: "kept" },
  },
  {
    ms: 450,
    cursor: inner(NOTE_DROPPED.x, NOTE_DROPPED.y),
    set: { noteOpen: false },
  },
];

/** Press the grid shortcut: its keys flash, and the folder tidies into a grid. */
const GRID_STEPS: Step[] = [
  { ms: 350, set: { keyHint: true } },
  { ms: 1300, set: { gridView: true } },
  { ms: 300, set: { keyHint: false } },
];

/** Click a folder, do a few things inside, click the parent crumb to leave. */
function folderVisit(
  folder: FolderKey,
  chapter: ChapterId,
  exitCam: CameraPose,
  /** More to do inside, after the note has been dragged. */
  extra: Step[] = [],
): Step[] {
  const c = FOLDER_CENTERS[folder];
  return [
    {
      ms: 450,
      checkpoint: chapter,
      cursor: world(c.x, c.y),
      set: { mounted: folder, innerMoved: false, gridView: false },
    },
    { ms: 200, cursor: world(c.x, c.y, true), hover: folder },
    {
      ms: 650,
      cam: FOLDER_FOCUS[folder],
      cursor: world(c.x, c.y),
      hover: folder,
    },
    // Inside.
    { ms: 300, set: { inside: folder }, cursor: inner(300, 160) },
    { ms: 450, cursor: inner(INNER_SLOT.x, INNER_SLOT.y) },
    {
      ms: 700,
      set:
        folder === "lighting"
          ? { lightingAdded: true }
          : { furnitureAdded: true },
    },
    { ms: 450, cursor: inner(INNER_NOTE.x, INNER_NOTE.y) },
    {
      ms: 600,
      set: { innerMoved: true },
      innerLift: true,
      cursor: inner(INNER_NOTE.x, INNER_NOTE.y + INNER_NOTE_DROP, true),
    },
    { ms: 500, cursor: inner(INNER_NOTE.x, INNER_NOTE.y + INNER_NOTE_DROP) },
    ...extra,
    { ms: 550, cursor: { in: "screen", to: "crumb" } },
    {
      ms: 200,
      cursor: { in: "screen", to: "crumb", press: true },
      crumbHot: true,
    },
    { ms: 650, set: { inside: null }, cam: exitCam, cursor: world(c.x, c.y) },
  ];
}

const STEPS: Step[] = [
  // Collect: look across the board and hover a colour (it offers "Copy hex").
  {
    ms: 500,
    checkpoint: "collect",
    cam: CAMERA_STOPS.overview,
    cursor: world(470, 500),
  },
  { ms: 500, cursor: world(704, 400) },
  { ms: 500, hover: "clay" },
  // Onto the "Copy hex" badge, click it, and the app confirms with a toast.
  { ms: 450, hover: "clay", pillHot: true, cursor: world(704, 477) },
  { ms: 200, hover: "clay", pillHot: true, cursor: world(704, 477, true) },
  {
    ms: 1100,
    hover: "clay",
    pillHot: true,
    cursor: world(704, 477),
    set: { toast: true },
  },
  { ms: 300 },

  // Capture: paste three new cards into free space at the board's edge.
  {
    ms: 600,
    checkpoint: "capture",
    cam: CAMERA_STOPS.capture,
    cursor: world(slot(0).x - 70, slot(0).y - 50),
  },
  {
    ms: 900,
    cursor: world(slot(0).x, slot(0).y),
    set: { pasted: 1, toast: false },
  },
  { ms: 500, cursor: world(slot(1).x, slot(1).y) },
  { ms: 1000, set: { pasted: 2 } },
  { ms: 500, cursor: world(slot(2).x, slot(2).y) },
  { ms: 1000, set: { pasted: 3 } },

  // Write: tick two items off the checklist.
  {
    ms: 600,
    checkpoint: "write",
    cam: CAMERA_STOPS.write,
    cursor: world(590, 380),
  },
  { ms: 450, cursor: { in: "world", to: "box0" } },
  {
    ms: 650,
    cursor: { in: "world", to: "box0", press: true },
    set: { ticked: 1 },
  },
  { ms: 450, cursor: { in: "world", to: "box1" } },
  {
    ms: 900,
    cursor: { in: "world", to: "box1", press: true },
    set: { ticked: 2 },
  },

  // Organize: drag the lamp photo into the Lighting folder.
  {
    ms: 600,
    checkpoint: "organize",
    cam: CAMERA_STOPS.organize,
    cursor: world(160, 200),
  },
  { ms: 200, cursor: world(160, 200, true), lamp: 1 },
  { ms: 500, cursor: world(160, 500, true), lamp: 2 },
  { ms: 200, lamp: 3, dropTarget: true },
  { ms: 350, cursor: world(160, 500), lamp: 4, set: { filed: true } },
  { ms: 500 },

  // Folders: open Lighting, where the lamp now is.
  ...folderVisit("lighting", "folders", CAMERA_STOPS.organize, AGENT_STEPS),

  // Arrange: drag a note across the board to a new spot.
  {
    ms: 600,
    checkpoint: "arrange",
    cam: CAMERA_STOPS.overview,
    cursor: world(976, 640),
  },
  { ms: 200, cursor: world(976, 640, true), set: { noteLift: true } },
  {
    ms: 700,
    cursor: world(976 + NOTE_MOVE.x, 640 + NOTE_MOVE.y, true),
    set: { noteMoved: true },
  },
  {
    ms: 500,
    cursor: world(976 + NOTE_MOVE.x, 640 + NOTE_MOVE.y),
    set: { noteLift: false },
  },

  // Search: open the filter bar, pick a colour, step through the matches,
  // then clear it. Images that do not match are dimmed, as on a real board.
  {
    ms: 450,
    checkpoint: "search",
    cam: CAMERA_STOPS.overview,
    set: { filterOpen: true },
  },
  { ms: 500, cursor: { in: "screen", to: "swatch" } },
  {
    ms: 200,
    cursor: { in: "screen", to: "swatch", press: true },
    set: { searchColor: true, searching: true },
  },
  {
    ms: 600,
    cursor: { in: "screen", to: "swatch" },
    set: { searching: false },
  },
  { ms: 500, cursor: { in: "screen", to: "matchNext" } },
  {
    ms: 200,
    cursor: { in: "screen", to: "matchNext", press: true },
    set: { focus: 0 },
    cam: SEARCH_CAMS[0],
  },
  { ms: 900, cursor: { in: "screen", to: "matchNext" } },
  {
    ms: 200,
    cursor: { in: "screen", to: "matchNext", press: true },
    set: { focus: 1 },
    cam: SEARCH_CAMS[1],
  },
  { ms: 900, cursor: { in: "screen", to: "matchNext" } },
  { ms: 450, cursor: { in: "screen", to: "filterClear" } },
  {
    ms: 200,
    cursor: { in: "screen", to: "filterClear", press: true },
    set: { searchColor: false, focus: null },
    cam: CAMERA_STOPS.overview,
  },
  {
    ms: 550,
    cursor: { in: "screen", to: "filterClear" },
    set: { filterOpen: false },
  },

  // Annotate: with the text tool (an I-beam cursor) type a label, then with
  // the arrow tool (a crosshair) draw from the label to the colour it is about.
  {
    ms: 600,
    checkpoint: "annotate",
    cam: ANNOTATE_CAM,
    cursor: world(TEXT_AT.x + 8, TEXT_AT.y + 18),
    set: { tool: "text" },
  },
  {
    ms: 250,
    cursor: world(TEXT_AT.x + 8, TEXT_AT.y + 18, true),
    set: { textEditing: true },
  },
  {
    ms: 300,
    cursor: world(TEXT_AT.x + 8, TEXT_AT.y + 18),
    set: { textChars: 6 },
  },
  { ms: 300, set: { textChars: 10 } },
  { ms: 400, set: { textChars: CANVAS_TEXT.length } },
  {
    ms: 550,
    cursor: world(ARROW_FROM.x, ARROW_FROM.y),
    set: { textEditing: false, tool: "arrow" },
  },
  {
    ms: 700,
    cursor: world(ARROW_TO.x, ARROW_TO.y, true),
    set: { arrow: true },
  },
  { ms: 400, cursor: world(ARROW_TO.x, ARROW_TO.y), set: { tool: "select" } },
  // Grab the arrow by its middle and pull it out into a bend.
  { ms: 450, cursor: world(ARROW_MID.x, ARROW_MID.y) },
  {
    ms: 600,
    cursor: world(ARROW_MID.x + ARROW_BEND.x, ARROW_MID.y + ARROW_BEND.y, true),
    set: { arrowBent: true },
  },
  {
    ms: 500,
    cursor: world(ARROW_MID.x + ARROW_BEND.x, ARROW_MID.y + ARROW_BEND.y),
  },

  // Browse: open Furniture, then cut back to the start of the loop.
  ...folderVisit("furniture", "browse", CAMERA_STOPS.overview, GRID_STEPS),
  { ms: 700 },
  // The cut: the board dips out, is put back to how the loop began, and the
  // first chapter fades it in again.
  { ms: 300, dip: true },
  {
    ms: 350,
    dip: true,
    set: { ...BOARD_START, lightingAdded: false, furnitureAdded: false },
  },
];

function build(): Frame[] {
  const hidden = (to: CursorTarget): CursorState => ({
    to,
    visible: false,
    press: false,
  });
  let sticky: Sticky = {
    pasted: 0,
    ticked: 0,
    filed: false,
    noteMoved: false,
    noteLift: false,
    inside: null,
    mounted: "lighting",
    lightingAdded: false,
    furnitureAdded: false,
    innerMoved: false,
    toast: false,
    filterOpen: false,
    searchColor: false,
    searching: false,
    focus: null,
    tool: "select",
    textChars: 0,
    textEditing: false,
    arrow: false,
    arrowBent: false,
    noteOpen: false,
    agent: "off",
    agentChars: 0,
    agentOut: 0,
    keyHint: false,
    gridView: false,
  };
  let chapter: ChapterId = "collect";
  let cam = CAMERA_STOPS.overview;
  const cursors: Record<Space, CursorState> = {
    world: hidden({ x: 470, y: 500 }),
    inner: hidden({ x: 300, y: 160 }),
    screen: hidden("crumb"),
  };

  return STEPS.map((step) => {
    if (step.checkpoint) chapter = step.checkpoint;
    if (step.cam) cam = step.cam;
    if (step.set) sticky = { ...sticky, ...step.set };
    if (step.cursor) {
      for (const space of ["world", "inner", "screen"] as const) {
        cursors[space] =
          space === step.cursor.in
            ? { to: step.cursor.to, visible: true, press: !!step.cursor.press }
            : { ...cursors[space], visible: false, press: false };
      }
    }
    return {
      ...sticky,
      ms: step.ms,
      chapter,
      checkpoint: !!step.checkpoint,
      cam,
      world: cursors.world,
      inner: cursors.inner,
      screen: cursors.screen,
      lamp: step.lamp ?? (sticky.filed ? 4 : 0),
      dropTarget: !!step.dropTarget,
      hover: step.hover ?? null,
      innerLift: !!step.innerLift,
      crumbHot: !!step.crumbHot,
      pillHot: !!step.pillHot,
      dip: !!step.dip,
    };
  });
}

/** The complete scene at every step of the loop. */
export const FRAMES: Frame[] = build();
