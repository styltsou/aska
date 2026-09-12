import { useEffect, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const SUGGESTION_MENU_TRANSITION_MS = 100;

export const SUGGESTION_MENU_EXIT_FALLBACK_MS =
  SUGGESTION_MENU_TRANSITION_MS + 50;

export type SuggestionMenuTransitionProps = {
  children: ReactNode;
  className?: string;
  exiting?: boolean;
  onExitComplete?: () => void;
};

export function SuggestionMenuTransition({
  children,
  className,
  exiting = false,
  onExitComplete,
}: SuggestionMenuTransitionProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!exiting || !reduceMotion) return;
    const frame = window.requestAnimationFrame(() => onExitComplete?.());
    return () => window.cancelAnimationFrame(frame);
  }, [exiting, onExitComplete, reduceMotion]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={
        exiting && !reduceMotion
          ? { opacity: 0, scale: 0.95 }
          : { opacity: 1, scale: 1 }
      }
      transition={{
        duration: reduceMotion ? 0 : SUGGESTION_MENU_TRANSITION_MS / 1_000,
        ease: [0, 0, 0.2, 1],
      }}
      className={cn(
        "origin-center",
        exiting && "pointer-events-none select-none",
        className,
      )}
      aria-hidden={exiting || undefined}
      onAnimationComplete={() => {
        if (exiting && !reduceMotion) onExitComplete?.();
      }}
    >
      {children}
    </motion.div>
  );
}
