import { LayoutGridIcon, PanelsTopLeftIcon } from "lucide-react";
import { motion } from "motion/react";

import type { BoardView } from "@/store/slices/board-slice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CollectionViewToggle({
  value,
  onChange,
}: {
  value: BoardView;
  onChange: (view: BoardView) => void;
}) {
  return (
    <div
      aria-label="Collection view"
      className="relative grid h-7 grid-cols-2 gap-0.5 rounded-md border border-border/60 bg-muted p-0.5 shadow-[0_1px_1px_rgb(0_0_0_/_0.02)] ring-1 ring-foreground/[0.025] backdrop-blur-sm"
      role="tablist"
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0.5 left-0.5 z-0 w-[calc((100%_-_0.375rem)/2)] rounded-[calc(var(--radius-md)-2px)] bg-gradient-to-b from-background to-background/85 shadow-[0_1px_2px_rgb(0_0_0_/_0.12),inset_0_1px_0_rgb(255_255_255_/_0.12)] ring-1 ring-foreground/[0.05]"
        initial={false}
        animate={{
          x: value === "canvas" ? 0 : "calc(100% + 0.125rem)",
        }}
        transition={{
          duration: 0.12,
          ease: [0.16, 1, 0.3, 1],
        }}
      />
      <ViewButton
        active={value === "canvas"}
        onClick={() => onChange("canvas")}
      >
        <PanelsTopLeftIcon />
        Canvas
      </ViewButton>
      <ViewButton
        active={value === "browse"}
        onClick={() => onChange("browse")}
      >
        <LayoutGridIcon />
        Browse
      </ViewButton>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      className={cn(
        "relative isolate h-full px-2",
        active
          ? "text-foreground hover:bg-transparent hover:text-foreground"
          : "text-muted-foreground transition-colors duration-[50ms] hover:bg-foreground/[0.05] hover:text-foreground active:bg-foreground/[0.08] dark:hover:bg-foreground/[0.1] dark:active:bg-foreground/[0.14]",
      )}
      aria-selected={active}
      role="tab"
      onClick={onClick}
    >
      <span className="relative z-10 flex items-center gap-1">{children}</span>
    </Button>
  );
}
