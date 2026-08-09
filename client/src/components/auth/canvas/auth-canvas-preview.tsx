import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import type { FolderAsset, ImageAsset, NoteAsset } from "@/types/asset";

const COLUMN_OFFSETS = [
  "-translate-y-32",
  "-translate-y-12",
  "-translate-y-32",
  "-translate-y-4",
];

const TYPE_STUDY: ImageAsset = {
  id: "auth-type-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1583161904728-4c4861ae469f?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 720,
  alt: "",
};

const FORM_STUDY: ImageAsset = {
  id: "auth-form-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1620003039413-b519b3c12e4d?auto=format&fit=crop&w=800&q=80",
  width: 640,
  height: 500,
  alt: "",
};

const GRID_STUDY: ImageAsset = {
  id: "auth-grid-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1705832567186-d0c628ea2c9b?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 440,
  alt: "",
};

const INTERIOR_STUDY: ImageAsset = {
  id: "auth-interior-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1639690440445-dd7c8ab2d8af?auto=format&fit=crop&w=800&q=80",
  width: 640,
  height: 500,
  alt: "",
};

const MATERIAL_STUDY: ImageAsset = {
  id: "auth-material-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 440,
  alt: "",
};

const SPACE_STUDY: ImageAsset = {
  id: "auth-space-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 720,
  alt: "",
};

const RED_STUDY: ImageAsset = {
  id: "auth-red-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 440,
  alt: "",
};

const GREEN_STUDY: ImageAsset = {
  id: "auth-green-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 720,
  alt: "",
};

const MATERIAL_NOTE: NoteAsset = {
  id: "auth-material-note",
  type: "note",
  content:
    "### Material cues\n\nMatte surfaces, one saturated detail, and shadow that describes depth.",
};

const COLOUR_NOTE: NoteAsset = {
  id: "auth-colour-note",
  type: "note",
  content:
    "### Colour as structure\n\nA saturated mark can do more work than a page of explanation.",
  color: "#c77c55",
};

const RHYTHM_NOTE: NoteAsset = {
  id: "auth-rhythm-note",
  type: "note",
  content: "### Rhythm\n\nRepeat the spacing, not the idea.",
  color: "#b9c7c2",
};

const EDGE_NOTE: NoteAsset = {
  id: "auth-edge-note",
  type: "note",
  content: "### Edge\n\nA clean crop can make a collection feel intentional.",
};

const LIGHT_NOTE: NoteAsset = {
  id: "auth-light-note",
  type: "note",
  content: "### Light\n\nUse contrast to describe form, not decorate it.",
  color: "#d9d4c8",
};

const EDIT_NOTE: NoteAsset = {
  id: "auth-edit-note",
  type: "note",
  content:
    "### Edit\n\nKeep only the reference that changes the next decision.",
};

const SHAPE_STUDY: ImageAsset = {
  id: "auth-shape-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 500,
  alt: "",
};

const SURFACE_NOTE: NoteAsset = {
  id: "auth-surface-note",
  type: "note",
  content:
    "### Surface\n\nTexture belongs where it helps the eye measure depth.",
  color: "#b9c7c2",
};

const PALETTE_NOTE: NoteAsset = {
  id: "auth-palette-note",
  type: "note",
  content:
    "### Palette\n\nChoose colour families before choosing individual colours.",
};

const FOCUS_NOTE: NoteAsset = {
  id: "auth-focus-note",
  type: "note",
  content:
    "### Focus\n\nThe strongest reference is often the most specific one.",
  color: "#d9d4c8",
};

const BALANCE_NOTE: NoteAsset = {
  id: "auth-balance-note",
  type: "note",
  content: "### Balance\n\nOffset the weight, then let the empty space work.",
};

const DETAIL_NOTE: NoteAsset = {
  id: "auth-detail-note",
  type: "note",
  content:
    "### Detail\n\nA small material change can carry the whole composition.",
  color: "#c77c55",
};

const INDEX_STUDY: ImageAsset = {
  id: "auth-index-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 440,
  alt: "",
};

const CROP_STUDY: ImageAsset = {
  id: "auth-crop-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 620,
  alt: "",
};

const ARCHIVE_STUDY: ImageAsset = {
  id: "auth-archive-study",
  type: "image",
  url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
  width: 560,
  height: 420,
  alt: "",
};

const PAUSE_NOTE: NoteAsset = {
  id: "auth-pause-note",
  type: "note",
  content: "### Pause\n\nMake room for the next useful connection.",
  color: "#b9c7c2",
};

const REFERENCE_PREVIEW_URLS = [
  "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1574870111867-089730e5a72b?auto=format&fit=crop&w=800&q=80",
];

const MATERIAL_PREVIEW_URLS = [
  "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80",
];

const PACE_PREVIEW_URLS = [
  "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=80",
];

const REFERENCES_FOLDER: FolderAsset = {
  id: "auth-references-folder",
  type: "folder",
  name: "Visual references",
  count: 12,
  previews: [
    {
      assetId: "auth-references-folder-preview-1",
      type: "image",
      url: REFERENCE_PREVIEW_URLS[0],
    },
    {
      assetId: "auth-references-folder-preview-2",
      type: "image",
      url: REFERENCE_PREVIEW_URLS[1],
    },
    {
      assetId: "auth-references-folder-note-preview",
      type: "note",
      color: "#c77c55",
      snippet: "Reference set\n\nA small selection for the next pass.",
    },
    {
      assetId: "auth-references-folder-preview-3",
      type: "image",
      url: REFERENCE_PREVIEW_URLS[2],
    },
  ],
};

const MATERIALS_FOLDER: FolderAsset = {
  id: "auth-materials-folder",
  type: "folder",
  name: "Material library",
  count: 8,
  previews: [
    {
      assetId: "auth-materials-folder-preview-1",
      type: "image",
      url: MATERIAL_PREVIEW_URLS[0],
    },
    {
      assetId: "auth-materials-folder-preview-2",
      type: "image",
      url: MATERIAL_PREVIEW_URLS[1],
    },
    {
      assetId: "auth-materials-folder-preview-3",
      type: "image",
      url: MATERIAL_PREVIEW_URLS[2],
    },
    {
      assetId: "auth-materials-folder-note-preview",
      type: "note",
      color: "#b9c7c2",
      snippet: "Surface samples\n\nColour, grain, and edge quality.",
    },
  ],
};

const PACE_FOLDER: FolderAsset = {
  id: "auth-pace-folder",
  type: "folder",
  name: "Pacing studies",
  count: 9,
  previews: PACE_PREVIEW_URLS.map((url, index) => ({
    assetId: `auth-pace-folder-preview-${index + 1}`,
    type: "image" as const,
    url,
  })),
};

type PreviewAsset = ImageAsset | NoteAsset | FolderAsset;

const CANVAS_COLUMNS: PreviewAsset[][] = [
  [
    RHYTHM_NOTE,
    MATERIALS_FOLDER,
    TYPE_STUDY,
    MATERIAL_NOTE,
    GRID_STUDY,
    EDGE_NOTE,
    LIGHT_NOTE,
  ],
  [
    EDIT_NOTE,
    RED_STUDY,
    COLOUR_NOTE,
    PACE_FOLDER,
    SHAPE_STUDY,
    SURFACE_NOTE,
    FOCUS_NOTE,
  ],
  [
    PALETTE_NOTE,
    GREEN_STUDY,
    INTERIOR_STUDY,
    FORM_STUDY,
    MATERIAL_STUDY,
    BALANCE_NOTE,
    INDEX_STUDY,
  ],
  [
    DETAIL_NOTE,
    REFERENCES_FOLDER,
    SPACE_STUDY,
    PAUSE_NOTE,
    CROP_STUDY,
    ARCHIVE_STUDY,
  ],
];

export function AuthCanvasPreview() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute top-1/2 left-[68%] grid w-[51rem] origin-center [transform:translate(-50%,-50%)_perspective(1200px)_rotateX(4deg)_rotateY(-11deg)_rotateZ(-7deg)_scale(1.02)] grid-cols-[repeat(4,10.5rem)] gap-7 p-8">
        <div className="absolute -inset-[32rem] z-0 bg-[color-mix(in_oklch,var(--muted)_58%,var(--background))] bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_17%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]" />
        {CANVAS_COLUMNS.map((column, columnIndex) => (
          <div
            key={`column-${columnIndex}`}
            className={`flex flex-col gap-7 ${COLUMN_OFFSETS[columnIndex]}`}
          >
            {column.map((asset, itemIndex) => (
              <div
                key={`${asset.id}-${itemIndex}`}
                className="relative z-[1] min-w-0 [&>*]:shadow-[0_0.5rem_1rem_-0.75rem_color-mix(in_oklch,var(--foreground)_14%,transparent)]"
                data-preview-kind={asset.type}
              >
                {asset.type === "image" ? (
                  <ImageAssetCard asset={asset} />
                ) : null}
                {asset.type === "note" ? <NoteAssetCard asset={asset} /> : null}
                {asset.type === "folder" ? (
                  <FolderAssetCard asset={asset} />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
