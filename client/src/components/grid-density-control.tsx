import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { GRID_DENSITIES, type GridDensity } from "@/components/grid-density";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

export function GridDensityControl({
  value,
  onChange,
}: {
  value: GridDensity;
  onChange: (value: GridDensity) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number }>();
  const reduceMotion = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const active = container.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]',
      );
      if (active)
        setThumb({ left: active.offsetLeft, width: active.offsetWidth });
    };
    update();
    const observer = new ResizeObserver(update);
    container
      .querySelectorAll("button")
      .forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={containerRef}
      data-grid-control
      role="group"
      aria-label="Grid size"
      className={cn(
        "pointer-events-auto relative flex h-fit items-center rounded-lg border border-border/70 p-0.5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-background/50",
        GLASS_FRAME_CLASS,
        "ring-0",
      )}
    >
      {thumb ? (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ x: thumb.left, width: thumb.width }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 500, damping: 35, mass: 0.9 }
          }
          className="pointer-events-none absolute inset-y-0.5 left-0 rounded-md bg-foreground shadow-sm"
        />
      ) : null}
      {(
        Object.entries(GRID_DENSITIES) as [
          GridDensity,
          (typeof GRID_DENSITIES)[GridDensity],
        ][]
      ).map(([option, preset]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "relative rounded-md px-2.5 py-1 text-xs transition-colors",
            value === option
              ? "text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
