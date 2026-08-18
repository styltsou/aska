import { ViewportPortal } from "@xyflow/react";
import type { CSSProperties } from "react";

import type { CanvasAlignmentGuides } from "./canvas-alignment-guides";

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
            className="aska-alignment-guide aska-alignment-guide--vertical"
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
            className="aska-alignment-guide aska-alignment-guide--horizontal"
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
