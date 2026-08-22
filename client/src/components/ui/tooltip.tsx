"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const TOOLTIP_EASE_OUT = [0.16, 1, 0.3, 1] as const;

const REDUCED_TOOLTIP_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.14, ease: TOOLTIP_EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: TOOLTIP_EASE_OUT },
  },
  instant: { opacity: 1, transition: { duration: 0 } },
};

function buildTooltipVariants(side: string): Variants {
  const offset =
    side === "top"
      ? { y: 8 }
      : side === "bottom"
        ? { y: -8 }
        : side === "left" || side === "inline-start"
          ? { x: 8 }
          : { x: -8 };

  return {
    initial: {
      opacity: 0,
      scale: 0.9,
      filter: "blur(5px)",
      x: offset.x ?? 0,
      y: offset.y ?? 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      x: 0,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 380,
        damping: 30,
        mass: 0.7,
        opacity: { duration: 0.14, ease: TOOLTIP_EASE_OUT },
        filter: { duration: 0.18, ease: TOOLTIP_EASE_OUT },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.94,
      filter: "blur(3px)",
      x: (offset.x ?? 0) * 0.6,
      y: (offset.y ?? 0) * 0.6,
      transition: { duration: 0.12, ease: TOOLTIP_EASE_OUT },
    },
    instant: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      x: 0,
      y: 0,
      transition: { duration: 0 },
    },
  };
}

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 8,
  align = "center",
  alignOffset = 0,
  children,
  render,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion
    ? REDUCED_TOOLTIP_VARIANTS
    : buildTooltipVariants(side);
  const popupRender =
    render ??
    ((popupProps, state) => (
      <motion.div
        {...(popupProps as ComponentProps<typeof motion.div>)}
        initial={state.instant ? false : "initial"}
        animate={
          state.instant
            ? "instant"
            : state.transitionStatus === "ending"
              ? "exit"
              : "animate"
        }
        variants={variants}
      />
    ));

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          render={popupRender}
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-lg outline-none has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
