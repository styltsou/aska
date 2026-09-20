import { useReactFlow, useViewport, type XYPosition } from "@xyflow/react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";

export function CanvasScreenOverlay({
  anchor,
  align = "start",
  offset = 10,
  children,
}: {
  anchor: XYPosition;
  align?: "start" | "center";
  offset?: number;
  children: React.ReactNode;
}) {
  const { flowToScreenPosition } = useReactFlow();
  useViewport();

  if (typeof document === "undefined") return null;

  const position = flowToScreenPosition(anchor);
  return createPortal(
    <div
      className="pointer-events-auto fixed z-40"
      style={{
        left: position.x,
        top: position.y - offset,
        transform:
          align === "center" ? "translate(-50%, -100%)" : "translateY(-100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}
