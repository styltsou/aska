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
  sizeScale: number;
  previewScale: number;
  previewOffsetY: number;
  fontWeight: number;
  letterSpacing: string;
  textStroke?: string;
}> = [
  {
    value: "inter",
    label: "Sans",
    className: "font-sans",
    sizeScale: 1,
    previewScale: 1,
    previewOffsetY: 0,
    fontWeight: 400,
    letterSpacing: "0",
  },
  {
    value: "fraunces",
    label: "Serif",
    className: "font-editorial",
    sizeScale: 1.04,
    previewScale: 1,
    previewOffsetY: 0,
    fontWeight: 500,
    letterSpacing: "-0.01em",
  },
  {
    value: "ibm_plex_mono",
    label: "Mono",
    className: "font-mono",
    sizeScale: 0.94,
    previewScale: 0.92,
    previewOffsetY: 0,
    fontWeight: 400,
    letterSpacing: "-0.035em",
  },
  {
    value: "sue_ellen_francisco",
    label: "Pencil",
    className: "font-handwritten",
    sizeScale: 1.34,
    previewScale: 1.08,
    previewOffsetY: 1,
    fontWeight: 400,
    letterSpacing: "0.01em",
    textStroke: "0.006em currentColor",
  },
];

export const CANVAS_TEXT_SIZES: Array<{
  value: CanvasTextSize;
  label: string;
  className: string;
  fontSize: number;
  lineHeight: number;
}> = [
  {
    value: "sm",
    label: "S",
    className: "text-base leading-[1.25]",
    fontSize: 16,
    lineHeight: 1.25,
  },
  {
    value: "md",
    label: "M",
    className: "text-2xl leading-[1.2]",
    fontSize: 24,
    lineHeight: 1.2,
  },
  {
    value: "lg",
    label: "L",
    className: "text-4xl leading-[1.12]",
    fontSize: 36,
    lineHeight: 1.12,
  },
  {
    value: "xl",
    label: "XL",
    className: "text-[3.5rem] leading-[1.05]",
    fontSize: 56,
    lineHeight: 1.05,
  },
];

export function canvasTextTypography(
  fontValue: CanvasTextFont,
  sizeValue: CanvasTextSize,
) {
  const font = CANVAS_TEXT_FONTS.find(({ value }) => value === fontValue)!;
  const size = CANVAS_TEXT_SIZES.find(({ value }) => value === sizeValue)!;

  return {
    className: font.className,
    style: {
      fontSize: `${size.fontSize * font.sizeScale}px`,
      lineHeight: size.lineHeight / font.sizeScale,
      fontWeight: font.fontWeight,
      letterSpacing: font.letterSpacing,
      WebkitTextStroke: font.textStroke,
    },
  };
}

export function canvasTextFontPreviewStyle(
  fontValue: CanvasTextFont,
  baseFontSize: number,
) {
  const font = CANVAS_TEXT_FONTS.find(({ value }) => value === fontValue)!;

  return {
    fontSize: `${baseFontSize * font.previewScale}px`,
    lineHeight: `${baseFontSize}px`,
    position: "relative" as const,
    top: `${font.previewOffsetY}px`,
    fontWeight: font.fontWeight,
    letterSpacing: font.letterSpacing,
    WebkitTextStroke: font.textStroke,
  };
}

export function canvasObjectColor(color: CanvasObjectColor) {
  return `var(--canvas-object-${color})`;
}

export function arrowDashArray(pattern: CanvasArrowPattern) {
  if (pattern === "dashed") return "10 8";
  if (pattern === "dotted") return "1 8";
  return undefined;
}
