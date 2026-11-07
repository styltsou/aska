import { useLayoutEffect, useRef, useState } from "react";

export const PREVIEW_STACK_TRANSITION =
  "transition-[translate,rotate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

type Size = { width: number; height: number };
export type PreviewStackPose = {
  translate: string;
  rotate: string;
  scale: number;
};

export function getPreviewStackTransforms(
  sizes: Size[],
  frame: Size,
  active: boolean,
) {
  if (!sizes.length || !frame.width || !frame.height) return [];
  const unit = frame.width / 280;
  const front = sizes[0];
  const getPositions = (spread: boolean) =>
    sizes.map((size, index) => {
      const side = index % 2 ? -1 : 1;
      const reveal = ((spread ? 18 : 8) + index * (spread ? 5 : 3)) * unit;
      return {
        x: index ? side * ((front.width - size.width) / 2 + reveal) : 0,
        y: index
          ? (front.height - size.height) * 0.15 +
            index * (spread ? 7 : 3) * unit
          : spread
            ? -2 * unit
            : 0,
        rotation: index ? side * (0.8 + index * (spread ? 1 : 0.4)) : 0,
      };
    });
  const positions = getPositions(active);
  const getBounds = (layout: typeof positions) =>
    layout.map(({ x, y, rotation }, index) => {
      const { width, height } = sizes[index];
      const radians = (Math.abs(rotation) * Math.PI) / 180;
      const halfWidth =
        (width * Math.cos(radians) + height * Math.sin(radians)) / 2;
      const halfHeight =
        (height * Math.cos(radians) + width * Math.sin(radians)) / 2;
      return {
        left: x - halfWidth,
        right: x + halfWidth,
        top: y - halfHeight,
        bottom: y + halfHeight,
      };
    });
  const bounds = getBounds(positions);
  const spreadBounds = getBounds(getPositions(true));
  const left = Math.min(...bounds.map((bound) => bound.left));
  const right = Math.max(...bounds.map((bound) => bound.right));
  const top = Math.min(...bounds.map((bound) => bound.top));
  const bottom = Math.max(...bounds.map((bound) => bound.bottom));
  const shiftX = -(left + right) / 2;
  const shiftY = -(top + bottom) / 2;
  // Fit against the open fan in both states so hovering never shrinks the pile.
  const spreadWidth =
    Math.max(...spreadBounds.map((bound) => bound.right)) -
    Math.min(...spreadBounds.map((bound) => bound.left));
  const spreadHeight =
    Math.max(...spreadBounds.map((bound) => bound.bottom)) -
    Math.min(...spreadBounds.map((bound) => bound.top));
  const scale = Math.min(
    1,
    (frame.width * 0.94) / spreadWidth,
    (frame.height * 0.94) / spreadHeight,
  );
  return positions.map(({ x, y, rotation }) => ({
    translate: `calc(-50% + ${((x + shiftX) * scale).toFixed(2)}px) calc(-50% + ${((y + shiftY) * scale).toFixed(2)}px)`,
    rotate: `${rotation}deg`,
    scale: Number(scale.toFixed(4)),
  }));
}

export function usePreviewStackLayout(active: boolean, previewIds: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [poses, setPoses] = useState<PreviewStackPose[]>([]);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-preview-stack-card]"),
    );
    const update = () => {
      const next = getPreviewStackTransforms(
        cards.map((card) => ({
          width: card.offsetWidth,
          height: card.offsetHeight,
        })),
        { width: container.clientWidth, height: container.clientHeight },
        active,
      );
      setPoses((current) =>
        current.length === next.length &&
        current.every(
          (value, index) =>
            value.translate === next[index].translate &&
            value.rotate === next[index].rotate &&
            value.scale === next[index].scale,
        )
          ? current
          : next,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    cards.forEach((card) => observer.observe(card));
    update();
    return () => observer.disconnect();
  }, [active, previewIds]);
  return { containerRef, poses };
}
