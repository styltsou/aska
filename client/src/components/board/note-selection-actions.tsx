import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { FLOATING_GLASS_BACKDROP_CLASS, GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

type NoteSelectionMenuSurfaceProps = ComponentProps<"div">;

/** A shared glass shell for the note editor's selection menu. */
export function NoteSelectionMenuSurface({
  children,
  className,
  ...props
}: NoteSelectionMenuSurfaceProps) {
  return (
    <div className={cn("relative w-fit", FLOATING_GLASS_BACKDROP_CLASS)}>
      <div
        className={cn(
          "relative z-10 rounded-lg p-1",
          GLASS_FRAME_CLASS,
          className,
        )}
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-1">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}
