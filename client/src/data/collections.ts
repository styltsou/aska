export interface CollectionSummary {
  slug: string;
  name: string;
  count: number;
  previews: string[];
}

const imageUrls = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=800&fit=crop",
  "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=600&h=500&fit=crop",
  "https://images.unsplash.com/photo-1618172193763-c511deb635ca?w=600&h=700&fit=crop",
  "https://images.unsplash.com/photo-1523800503107-5bc3ba2a6f81?w=600&h=450&fit=crop",
  "https://images.unsplash.com/photo-1549490349-8643362247b5?w=600&h=800&fit=crop",
];

function previewUrl(url: string) {
  return url.replace(/w=\d+/, "w=400").replace(/h=\d+/, "h=400");
}

export const collections: CollectionSummary[] = [
  {
    slug: "brand-identity",
    name: "Brand Identity",
    count: 24,
    previews: imageUrls.slice(0, 4).map(previewUrl),
  },
  {
    slug: "ui-concepts",
    name: "UI Concepts",
    count: 18,
    previews: imageUrls.slice(1, 5).map(previewUrl),
  },
  {
    slug: "typography",
    name: "Typography",
    count: 32,
    previews: imageUrls.slice(2, 6).map(previewUrl),
  },
  {
    slug: "color-palettes",
    name: "Color Palettes",
    count: 15,
    previews: imageUrls.slice(3, 7).map(previewUrl),
  },
  {
    slug: "inspo-2026",
    name: "Inspo 2026",
    count: 41,
    previews: imageUrls.slice(4, 8).map(previewUrl),
  },
  {
    slug: "photography",
    name: "Photography",
    count: 56,
    previews: imageUrls.slice(0, 4).map(previewUrl),
  },
  {
    slug: "architecture",
    name: "Architecture",
    count: 27,
    previews: imageUrls.slice(2, 6).map(previewUrl),
  },
  {
    slug: "motion-studies",
    name: "Motion Studies",
    count: 12,
    previews: imageUrls.slice(4, 8).map(previewUrl),
  },
];
