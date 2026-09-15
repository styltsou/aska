import type {
  CanvasArrowPattern,
  CanvasObjectColor,
  CanvasTextFont,
  CanvasTextSize,
} from "@/api/collection";

export const CANVAS_OBJECT_COLORS: CanvasObjectColor[] = [
  "ink",
  "cobalt",
  "coral",
  "moss",
  "ochre",
];

export const CANVAS_TEXT_FONTS: Array<{
  value: CanvasTextFont;
  label: string;
  className: string;
}> = [
  { value: "inter", label: "Sans", className: "font-sans" },
  {
    value: "fraunces",
    label: "Serif",
    className: "font-editorial",
  },
  {
    value: "ibm_plex_mono",
    label: "Mono",
    className: "font-mono",
  },
  {
    value: "sue_ellen_francisco",
    label: "Pencil",
    className: "font-handwritten",
  },
];

export const CANVAS_TEXT_SIZES: Array<{
  value: CanvasTextSize;
  label: string;
  className: string;
}> = [
  { value: "sm", label: "S", className: "text-base leading-[1.25]" },
  { value: "md", label: "M", className: "text-2xl leading-[1.2]" },
  { value: "lg", label: "L", className: "text-4xl leading-[1.12]" },
  { value: "xl", label: "XL", className: "text-[3.5rem] leading-[1.05]" },
];

export function canvasObjectColor(color: CanvasObjectColor) {
  return `var(--canvas-object-${color})`;
}

export function arrowDashArray(pattern: CanvasArrowPattern) {
  if (pattern === "dashed") return "10 8";
  if (pattern === "dotted") return "1 8";
  return undefined;
}
