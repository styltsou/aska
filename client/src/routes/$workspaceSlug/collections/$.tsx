import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { MasonryGrid, AssetCard } from "@/components/board";
import { MasonryGridSkeleton } from "@/components/masonry-grid-skeleton";
import { collectionFolders } from "@/data/collection-folders";
import { shouldShowSkeletonPreview } from "@/lib/dev-skeleton";
import { slugFromTitle } from "@/lib/slug";
import type { Asset } from "@/types/asset";

const imageUrls = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=800&fit=crop",
  "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1618172193763-c511deb635ca?w=600&h=700&fit=crop",
  "https://images.unsplash.com/photo-1523800503107-5bc3ba2a6f81?w=600&h=450&fit=crop",
  "https://images.unsplash.com/photo-1549490349-8643362247b5?w=600&h=800&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=650&fit=crop",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&h=700&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=850&fit=crop",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&h=750&fit=crop",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600&h=800&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&h=650&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600&h=700&fit=crop",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=550&fit=crop",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=850&fit=crop",
  "https://images.unsplash.com/photo-1504198266287-1659872e6590?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1518173946687-a36f968f7f9e?w=600&h=750&fit=crop",
  "https://images.unsplash.com/photo-1615729947596-a598e5de0ab3?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&h=800&fit=crop",
  "https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=600&h=650&fit=crop",
  "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=600&h=700&fit=crop",
];

const noteColors = [
  "#fef3c7",
  "#dbeafe",
  "#fce7f3",
  "#d1fae5",
  "#ede9fe",
  "#ffe4e6",
  "#e0e7ff",
  "#ccfbf1",
  "#f5e6d0",
  "#faf5ff",
  "#fef9c3",
  "#e0f2fe",
  "#fecaca",
  "#d9f99d",
  "#fde68a",
];

const notes = [
  "Mood: warm earth tones with pops of electric blue. Think '70s Italian design meets modern web.",
  "Grid systems that breathe — generous whitespace, asymmetric layouts, content that feels tactile.",
  "Typography-driven layouts. Let the type do the work.",
  "Color palette: deep navy, terracotta, cream, and accents of mustard yellow.",
  "Reference: Japanese minimalism meets brutalist architecture. Raw materials, precise geometry.",
  "Texture references — linen, raw concrete, weathered brass, matte ceramics.",
  "Key takeaway: negative space isn't empty — it's a design element.",
  "Pairing serif headings with grotesk body text creates a nice tension.",
  "Inspired by mid-century print — asymmetrical grids, bold geometric shapes, Monsen.",
  "Lighting reference: golden hour with deep shadows, volumetric feel.",
  "Systems thinking: create constraints, then work within them brilliantly.",
  "Moodboard notes: organic shapes against rigid grids. Soft + hard.",
  "Color study: complementary palette of teal and coral with neutral anchors.",
  "Layout inspiration: editorial spreads with huge pull quotes and minimal imagery.",
  "Motion reference: slow, purposeful micro-interactions. No flashy animations.",
  "Texture palette: wool, leather, frosted glass, satin brass.",
  "Design principle: make the hierarchy so clear it feels invisible.",
  "Exploring the tension between digital precision and hand-made imperfection.",
  "Gradient study: warm neutrals shifting through rose to deep plum.",
];

type FolderPreview = { type: "image" | "note"; url?: string; color?: string };

const folderPreviewData: Record<string, FolderPreview[]> = {
  "Brand Identity": [
    { type: "image", url: imageUrls[0] + "&w=200&h=200&fit=crop" },
    { type: "image", url: imageUrls[1] + "&w=200&h=200&fit=crop" },
    { type: "note", color: "#f5e6d0" },
    { type: "image", url: imageUrls[2] + "&w=200&h=200&fit=crop" },
  ],
  "UI Concepts": [
    { type: "image", url: imageUrls[3] + "&w=200&h=200&fit=crop" },
    { type: "note", color: "#d0e6f5" },
    { type: "image", url: imageUrls[4] + "&w=200&h=200&fit=crop" },
  ],
  Typography: [
    { type: "note", color: "#fce7f3" },
    { type: "image", url: imageUrls[5] + "&w=200&h=200&fit=crop" },
    { type: "image", url: imageUrls[6] + "&w=200&h=200&fit=crop" },
    { type: "note", color: "#d1fae5" },
  ],
  "Color Palettes": [
    { type: "image", url: imageUrls[7] + "&w=200&h=200&fit=crop" },
    { type: "note", color: "#ede9fe" },
    { type: "image", url: imageUrls[8] + "&w=200&h=200&fit=crop" },
  ],
  "Inspo 2026": [
    { type: "image", url: imageUrls[9] + "&w=200&h=200&fit=crop" },
    { type: "image", url: imageUrls[10] + "&w=200&h=200&fit=crop" },
    { type: "note", color: "#fef9c3" },
    { type: "image", url: imageUrls[11] + "&w=200&h=200&fit=crop" },
  ],
  Photography: [
    { type: "image", url: imageUrls[12] + "&w=200&h=200&fit=crop" },
    { type: "note", color: "#e0f2fe" },
    { type: "image", url: imageUrls[13] + "&w=200&h=200&fit=crop" },
    { type: "image", url: imageUrls[14] + "&w=200&h=200&fit=crop" },
  ],
  Architecture: [
    { type: "image", url: imageUrls[15] + "&w=200&h=200&fit=crop" },
    { type: "image", url: imageUrls[16] + "&w=200&h=200&fit=crop" },
  ],
  "Motion Studies": [
    { type: "note", color: "#fecaca" },
    { type: "image", url: imageUrls[17] + "&w=200&h=200&fit=crop" },
    { type: "note", color: "#d9f99d" },
  ],
};

const folders: {
  name: string;
  count: number;
  previews?: FolderPreview[];
}[] = collectionFolders.map((folder) => ({
  ...folder,
  previews: folderPreviewData[folder.name],
}));

const noteColorMap = new Map(notes.map((_, i) => [i, noteColors[i % noteColors.length]]));
const folderPreviewsMap = new Map(folders.map((f) => [f.name, f.previews]));

const imageTitles = [
  "Abstract Forms",
  "Coastal Light",
  "Geometric Study",
  "Night Terrain",
  "Liquid Glass",
  "Urban Grid",
  "Golden Hour",
  "Texture Layer",
  "Minimal Void",
  "Mountain Dust",
  "Forest Canopy",
  "River Stone",
  "Moss & Concrete",
  "Horizon Line",
  "Sand Dune",
  "Storm Front",
  "Canyon Light",
  "Frost Pattern",
  "Clay Vessel",
  "Steel Frame",
  "Morning Mist",
  "Lava Flow",
  "Tidal Pool",
  "Bamboo Shadows",
  "Wax & Wick",
  "Cloud Study",
  "Rust Oxide",
  "Arctic Blue",
];

const heights = [
  800, 400, 600, 900, 500, 700, 450, 800, 650, 900, 500, 700, 850, 600, 750, 500, 800, 650, 400,
  700, 550, 850, 600, 750, 500, 800, 650, 700,
];

const imageAssets: Asset[] = imageUrls.map((url, i) => ({
  id: `img-${i}`,
  type: "image" as const,
  url,
  width: 600,
  height: heights[i] ?? 600,
  title: imageTitles[i],
  ...(i < 10 ? { sourceLabel: "Unsplash" } : {}),
}));

const noteAssets: Asset[] = notes.map((content, i) => ({
  id: `note-${i}`,
  type: "note" as const,
  content,
  color: noteColorMap.get(i),
}));

const folderAssets: Asset[] = folders.map((f, i) => ({
  id: `folder-${i}`,
  type: "folder" as const,
  name: f.name,
  count: f.count,
  previews: folderPreviewsMap.get(f.name),
}));

const allAssets: Asset[] = [];
const maxLen = Math.max(imageAssets.length, noteAssets.length, folderAssets.length);
for (let i = 0; i < maxLen; i++) {
  if (i < imageAssets.length) allAssets.push(imageAssets[i]);
  if (i < noteAssets.length) allAssets.push(noteAssets[i]);
  if (i < folderAssets.length) allAssets.push(folderAssets[i]);
}

const collectionAssets: Record<string, Asset[]> = {
  "brand-identity": allAssets,
  "ui-concepts": allAssets.slice(0, 20),
  typography: allAssets.slice(5, 25),
  "color-palettes": allAssets.slice(10, 30),
  "inspo-2026": allAssets,
  photography: allAssets.slice(3, 23),
  architecture: allAssets.slice(8, 18),
  "motion-studies": allAssets.slice(15, 30),
};

const nestedFolderBoards: Record<string, Asset[]> = {
  "brand-identity/ui-concepts": [
    {
      id: "folder-ui-wireframes",
      type: "folder",
      name: "Wireframes",
      count: 16,
      previews: [
        { type: "image", url: imageUrls[2] + "&w=200&h=200&fit=crop" },
        { type: "note", color: "#dbeafe" },
        { type: "image", url: imageUrls[5] + "&w=200&h=200&fit=crop" },
        { type: "note", color: "#e0e7ff" },
      ],
    },
    {
      id: "folder-ui-components",
      type: "folder",
      name: "Components",
      count: 28,
      previews: [
        { type: "image", url: imageUrls[3] + "&w=200&h=200&fit=crop" },
        { type: "image", url: imageUrls[4] + "&w=200&h=200&fit=crop" },
        { type: "note", color: "#d1fae5" },
      ],
    },
    {
      id: "folder-ui-references",
      type: "folder",
      name: "References",
      count: 9,
      previews: [
        { type: "image", url: imageUrls[6] + "&w=200&h=200&fit=crop" },
        { type: "image", url: imageUrls[7] + "&w=200&h=200&fit=crop" },
      ],
    },
    imageAssets[3],
    noteAssets[2],
    imageAssets[4],
    noteAssets[6],
    imageAssets[6],
    noteAssets[10],
    imageAssets[8],
  ],
  "brand-identity/ui-concepts/components": [
    {
      id: "folder-ui-components-buttons",
      type: "folder",
      name: "Buttons",
      count: 7,
      previews: [
        { type: "note", color: "#fef3c7" },
        { type: "image", url: imageUrls[20] + "&w=200&h=200&fit=crop" },
        { type: "note", color: "#ccfbf1" },
      ],
    },
    {
      id: "folder-ui-components-navigation",
      type: "folder",
      name: "Navigation",
      count: 11,
      previews: [
        { type: "image", url: imageUrls[21] + "&w=200&h=200&fit=crop" },
        { type: "image", url: imageUrls[22] + "&w=200&h=200&fit=crop" },
        { type: "note", color: "#ede9fe" },
      ],
    },
    imageAssets[20],
    noteAssets[4],
    imageAssets[21],
    noteAssets[11],
    imageAssets[22],
    imageAssets[23],
  ],
  "brand-identity/ui-concepts/wireframes": [
    imageAssets[12],
    noteAssets[1],
    imageAssets[13],
    noteAssets[5],
    imageAssets[14],
    noteAssets[8],
    imageAssets[15],
    imageAssets[16],
  ],
  "brand-identity/typography": [
    {
      id: "folder-typography-specimens",
      type: "folder",
      name: "Specimens",
      count: 14,
      previews: [
        { type: "note", color: "#fce7f3" },
        { type: "image", url: imageUrls[17] + "&w=200&h=200&fit=crop" },
        { type: "note", color: "#faf5ff" },
      ],
    },
    noteAssets[2],
    imageAssets[17],
    noteAssets[7],
    imageAssets[18],
    noteAssets[13],
  ],
};

export const Route = createFileRoute("/$workspaceSlug/collections/$")({
  component: CollectionPage,
  pendingComponent: MasonryGridSkeleton,
});

function CollectionPage() {
  const { workspaceSlug, _splat } = Route.useParams();
  const collectionPath = _splat ?? "";
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const [collectionSlug] = collectionPath.split("/").filter(Boolean);
  const assets =
    nestedFolderBoards[collectionPath] ?? collectionAssets[collectionSlug] ?? allAssets;

  if (shouldShowSkeletonPreview(search)) {
    return <MasonryGridSkeleton />;
  }

  return (
    <MasonryGrid>
      {assets.map((asset) => {
        if (asset.type === "folder") {
          return (
            <Link
              key={asset.id}
              to="/$workspaceSlug/collections/$"
              params={{
                workspaceSlug,
                _splat: `${collectionPath}/${slugFromTitle(asset.name)}`,
              }}
              className="block"
            >
              <AssetCard asset={asset} />
            </Link>
          );
        }

        return <AssetCard key={asset.id} asset={asset} />;
      })}
    </MasonryGrid>
  );
}
