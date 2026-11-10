import { ViewportPortal } from "@xyflow/react";
import type { CSSProperties } from "react";

import type { CanvasAlignmentGuides } from "./canvas-alignment-guides";

const alignmentGuideClassName =
  "absolute [--alignment-guide-color:color-mix(in_oklch,var(--primary)_82%,transparent)]";

const verticalAlignmentGuideClassName =
  "bg-[repeating-linear-gradient(to_bottom,var(--alignment-guide-color)_0_var(--alignment-guide-dash),transparent_var(--alignment-guide-dash)_var(--alignment-guide-period))]";

const horizontalAlignmentGuideClassName =
  "bg-[repeating-linear-gradient(to_right,var(--alignment-guide-color)_0_var(--alignment-guide-dash),transparent_var(--alignment-guide-dash)_var(--alignment-guide-period))]";

export function CanvasAlignmentGuideLines({
  guides,
  zoom,
}: {
  guides?: CanvasAlignmentGuides;
  zoom: number;
}) {
  if (!guides?.vertical && !guides?.horizontal) {
    return null;
  }

  const thickness = 1 / zoom;
  const dashVariables = {
    "--alignment-guide-dash": `${4 / zoom}px`,
    "--alignment-guide-period": `${7 / zoom}px`,
  } as CSSProperties;

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {guides.vertical ? (
          <div
            className={`${alignmentGuideClassName} ${verticalAlignmentGuideClassName}`}
            style={{
              ...dashVariables,
              left: guides.vertical.coordinate - thickness / 2,
              top: guides.vertical.start,
              width: thickness,
              height: guides.vertical.end - guides.vertical.start,
            }}
          />
        ) : null}
        {guides.horizontal ? (
          <div
            className={`${alignmentGuideClassName} ${horizontalAlignmentGuideClassName}`}
            style={{
              ...dashVariables,
              left: guides.horizontal.start,
              top: guides.horizontal.coordinate - thickness / 2,
              width: guides.horizontal.end - guides.horizontal.start,
              height: thickness,
            }}
          />
        ) : null}
      </div>
    </ViewportPortal>
  );
}
