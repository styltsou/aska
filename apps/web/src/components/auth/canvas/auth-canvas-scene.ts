import type {
  ColorAsset,
  FolderAsset,
  FolderAssetPreview,
  ImageAsset,
  LinkAsset,
  NoteAsset,
  VideoAsset,
} from "@/types/asset";

/**
 * Where the auth canvas camera rests. Each stop frames one thing you actually
 * do on a board, and each auth view maps to one of them.
 */
export type AuthCanvasStop = "overview" | "capture" | "organize" | "write";

export type FolderKey = "lighting" | "furniture";

export interface CameraPose {
  /** The world point shown at the centre of the panel. */
  x: number;
  y: number;
  scale: number;
}

export const CAMERA_STOPS: Record<AuthCanvasStop, CameraPose> = {
  overview: { x: 568, y: 466, scale: 0.66 },
  capture: { x: 1100, y: 430, scale: 0.8 },
  organize: { x: 200, y: 380, scale: 1 },
  write: { x: 430, y: 430, scale: 1.15 },
};

/** Where the camera goes to open each folder: its card fills the panel. */
export const FOLDER_FOCUS: Record<FolderKey, CameraPose> = {
  lighting: { x: 160, y: 501, scale: 1.7 },
  furniture: { x: 160, y: 773, scale: 1.7 },
};

const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

function image(
  id: string,
  photoId: string,
  width: number,
  height: number,
): ImageAsset {
  return { id, type: "image", url: photo(photoId), width, height, alt: "" };
}

export const IMAGES = {
  lamp: image("auth-lamp", "photo-1524758631624-e2822e304c36", 560, 720),
  room: image("auth-room", "photo-1639690440445-dd7c8ab2d8af", 640, 500),
  chair: image("auth-chair", "photo-1620003039413-b519b3c12e4d", 640, 500),
  studio: image("auth-studio", "photo-1497366811353-6870744d04b2", 560, 420),
  swatches: image("auth-swatches", "photo-1561070791-2526d30994b5", 560, 440),
  wallLamp: image(
    "auth-wall-lamp",
    "photo-1494438639946-1ebd1d20bf85",
    560,
    720,
  ),
  redChair: image(
    "auth-red-chair",
    "photo-1583161904728-4c4861ae469f",
    560,
    720,
  ),
  notebook: image(
    "auth-notebook",
    "photo-1517842645767-c639042777db",
    560,
    420,
  ),
};

export const LINK: LinkAsset = {
  id: "auth-link",
  type: "link",
  originalUrl: "https://studiojournal.co/desk-lamps-that-dont-glare",
  hostname: "studiojournal.co",
  siteName: "Studio Journal",
  title: "Choosing a desk lamp that doesn't glare",
  description:
    "Colour temperature, shade depth and arm reach: what to check before you buy.",
  resourceKind: "article",
  resolutionStatus: "ready",
  previewImage: {
    url: photo("photo-1494438639946-1ebd1d20bf85"),
    width: 800,
    height: 450,
  },
};

export const SAVED_LINK: LinkAsset = {
  id: "auth-saved-link",
  type: "link",
  originalUrl: "https://studiojournal.co/layered-light-small-rooms",
  hostname: "studiojournal.co",
  siteName: "Studio Journal",
  title: "Layered light for small rooms",
  description:
    "Ambient, task and accent light: how to combine them without clutter.",
  resourceKind: "article",
  resolutionStatus: "ready",
  previewImage: {
    url: photo("photo-1497366811353-6870744d04b2"),
    width: 800,
    height: 450,
  },
};

export const COLORS: ColorAsset[] = [
  { id: "auth-clay", type: "color", hex: "#b8664a", title: "Clay" },
  { id: "auth-plaster", type: "color", hex: "#efe8dc", title: "Warm white" },
  { id: "auth-moss", type: "color", hex: "#6f7b52", title: "Moss" },
];

export const WALL_NOTE: NoteAsset = {
  id: "auth-wall-note",
  type: "note",
  title: "Wall colours",
  content:
    "Warm white on three walls, clay in the alcove. Test both on the north wall before ordering.",
};

const SCONCE_NOTE: NoteAsset = {
  id: "auth-sconce-note",
  type: "note",
  title: "Sconce options",
  content: "Brass arm, 2700K bulb. Plug-in, so no wiring.",
};

const DESK_NOTE: NoteAsset = {
  id: "auth-desk-note",
  type: "note",
  title: "Desk shortlist",
  content: "Oak top, 140 cm wide. Cable tray underneath.",
};

/** The checklist the "write" stop ticks through. */
export function lightingNote(ticked: number): NoteAsset {
  const box = (index: number) => (index < ticked ? "x" : " ");
  return {
    id: "auth-lighting-note",
    type: "note",
    title: "Lighting plan",
    content: [
      "- [x] Measure the window wall",
      `- [${box(0)}] Order two wall sconces`,
      `- [${box(1)}] Dimmer for the desk lamp`,
    ].join("\n"),
  };
}

const preview = (assetId: string, source: ImageAsset): FolderAssetPreview => ({
  assetId,
  type: "image",
  url: source.url,
});

export const LAMP_PREVIEW = preview("auth-folder-incoming", IMAGES.lamp);

const LIGHTING_PREVIEWS: FolderAssetPreview[] = [
  preview("auth-lighting-1", IMAGES.wallLamp),
  preview("auth-lighting-2", IMAGES.studio),
  preview("auth-lighting-3", IMAGES.room),
];

export function lightingFolder(
  withLamp: boolean,
  withLink = false,
): FolderAsset {
  // Newest first, as the real stack shows them.
  const added: FolderAssetPreview[] = [];
  if (withLink) {
    added.push({
      assetId: "auth-lighting-link",
      type: "link",
      url: LINK.previewImage?.url,
      title: LINK.title,
      hostname: LINK.hostname,
      siteName: LINK.siteName,
    });
  }
  if (withLamp) added.push(LAMP_PREVIEW);
  return {
    id: "auth-lighting-folder",
    type: "folder",
    name: "Lighting",
    count: 4 + added.length,
    previews: [...added, ...LIGHTING_PREVIEWS],
  };
}

const FURNITURE_PREVIEWS: FolderAssetPreview[] = [
  preview("auth-furniture-1", IMAGES.redChair),
  preview("auth-furniture-2", IMAGES.chair),
  preview("auth-furniture-3", IMAGES.studio),
];

export function furnitureFolder(withRoom: boolean): FolderAsset {
  return {
    id: "auth-furniture-folder",
    type: "folder",
    name: "Furniture",
    count: withRoom ? 5 : 4,
    previews: withRoom
      ? [preview("auth-furniture-room", IMAGES.room), ...FURNITURE_PREVIEWS]
      : FURNITURE_PREVIEWS,
  };
}

/** A short clip on the board. Only its poster is ever shown here. */
export const VIDEO: VideoAsset = {
  id: "auth-video",
  type: "video",
  // Never requested: the card shows the poster unless it is hovered.
  url: "/auth-preview-clip.mp4",
  posterUrl: photo("photo-1517842645767-c639042777db"),
  contentType: "video/mp4",
  width: 1280,
  height: 720,
  durationSeconds: 42,
  title: "Desk setup walkthrough",
  processingStatus: "completed",
};

/** Every card shares one width, as on a real board; heights follow content. */
const W = 240;

/** Card positions in world pixels (top-left corner), on a 32px gutter. */
export const LAYOUT = {
  lamp: { x: 40, y: 40, w: W },
  lightingFolder: { x: 40, y: 381, w: W },
  furnitureFolder: { x: 40, y: 653, w: W },
  link: { x: 312, y: 40, w: W },
  lightingNote: { x: 312, y: 332, w: W },
  swatches: { x: 312, y: 554, w: W },
  room: { x: 584, y: 40, w: W },
  clay: { x: 584, y: 260, w: W },
  moss: { x: 584, y: 586, w: W },
  chair: { x: 856, y: 40, w: W },
  plaster: { x: 856, y: 260, w: W },
  wallNote: { x: 856, y: 586, w: W },
} as const;

interface Box {
  x: number;
  y: number;
  w: number;
}

/**
 * Cards that are not on the board yet. Pasting brings them in one round at a
 * time and they stay: nothing on the canvas is ever taken away to be shown
 * again. They sit just past the right edge, so the board simply grows.
 */
export type PoolItem =
  | { key: string; kind: "image"; asset: ImageAsset; box: Box }
  | { key: string; kind: "video"; asset: VideoAsset; box: Box }
  | { key: string; kind: "link"; asset: LinkAsset; box: Box };

export const POOL: PoolItem[] = [
  {
    key: "pool-chair",
    kind: "image",
    asset: IMAGES.redChair,
    box: { x: 1128, y: 40, w: W },
  },
  {
    key: "pool-link",
    kind: "link",
    asset: SAVED_LINK,
    box: { x: 1128, y: 381, w: W },
  },
  {
    key: "pool-video",
    kind: "video",
    asset: VIDEO,
    box: { x: 1128, y: 672, w: W },
  },
];

export interface InnerCard {
  key: string;
  /** Top-left, relative to the middle of the folder's own board. */
  x: number;
  y: number;
  asset: ImageAsset | NoteAsset;
}

/** Where the note sits inside either folder (its top-left corner). */
export const INNER_NOTE_AT = { x: -90, y: -60 };

/**
 * What is inside each folder, placed loosely the way a hand-arranged board
 * is. The lamp joins Lighting once it is filed, and `noteExtra` is what the
 * agent added to the Lighting note.
 */
export function innerBoard(
  folder: FolderKey,
  hasLamp: boolean,
  noteExtra = "",
): InnerCard[] {
  if (folder === "lighting") {
    return [
      { key: "in-wall-lamp", x: -428, y: -318, asset: IMAGES.wallLamp },
      { key: "in-studio", x: -384, y: 62, asset: IMAGES.studio },
      { key: "in-room", x: -112, y: -340, asset: IMAGES.room },
      {
        key: "in-sconce",
        x: INNER_NOTE_AT.x,
        y: INNER_NOTE_AT.y,
        asset: noteExtra
          ? {
              ...SCONCE_NOTE,
              content: `${SCONCE_NOTE.content}\n\n${noteExtra}`,
            }
          : SCONCE_NOTE,
      },
      ...(hasLamp
        ? [{ key: "in-lamp", x: 196, y: -296, asset: IMAGES.lamp }]
        : []),
    ];
  }
  return [
    { key: "in-red-chair", x: -428, y: -326, asset: IMAGES.redChair },
    { key: "in-studio-f", x: -376, y: 54, asset: IMAGES.studio },
    { key: "in-chair", x: -118, y: -308, asset: IMAGES.chair },
    {
      key: "in-desk-note",
      x: INNER_NOTE_AT.x,
      y: INNER_NOTE_AT.y,
      asset: DESK_NOTE,
    },
    { key: "in-notebook", x: 204, y: -338, asset: IMAGES.notebook },
  ];
}

export const FOLDER_NAMES: Record<FolderKey, string> = {
  lighting: "Lighting",
  furniture: "Furniture",
};

/** What gets pasted into each folder while the camera is inside it. */
export const INNER_PASTE: Record<FolderKey, ImageAsset | LinkAsset> = {
  lighting: LINK,
  furniture: IMAGES.room,
};

/** Where that card lands, relative to the middle of the folder's board. */
export const INNER_PASTE_BOX = { x: 186, y: 84, w: 240 };
