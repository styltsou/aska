import type { Transition } from "motion/react";

export const SIDE_PANEL_INITIAL = { opacity: 0, x: 20, scale: 0.985 };
export const SIDE_PANEL_ANIMATE = { opacity: 1, x: 0, scale: 1 };
export const SIDE_PANEL_EXIT = {
  opacity: 0,
  x: 14,
  scale: 0.99,
  transition: {
    duration: 0.15,
    ease: [0.23, 1, 0.32, 1] as const,
  },
};
export const SIDE_PANEL_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.23, 1, 0.32, 1],
};
