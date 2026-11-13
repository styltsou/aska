import { flushSync } from "react-dom";

export const AUTH_VIEW_TRANSITION = { types: ["auth-switch"] };
export const AUTH_REVERSE_VIEW_TRANSITION = {
  types: ["auth-switch", "auth-reverse"],
};

// Same view, next step (e.g. email -> password): the copy is unchanged, so
// only the fields animate.
export const AUTH_STEP_TRANSITION = { types: ["auth-switch", "auth-step"] };
export const AUTH_REVERSE_STEP_TRANSITION = {
  types: ["auth-switch", "auth-step", "auth-reverse"],
};

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/onboarding",
]);

export function authHistoryTransitionTypes(
  fromPath: string | undefined,
  toPath: string,
  fromIndex: number | undefined,
  toIndex: number | undefined,
) {
  if (!fromPath || !AUTH_PATHS.has(fromPath) || !AUTH_PATHS.has(toPath)) {
    return false;
  }

  return [
    "auth-switch",
    fromIndex !== undefined && toIndex !== undefined && toIndex < fromIndex
      ? "auth-reverse"
      : "auth-forward",
  ];
}

export function transitionAuthStep(
  update: () => void,
  transition = AUTH_STEP_TRANSITION,
) {
  if (!document.startViewTransition) {
    update();
    return;
  }

  document.startViewTransition({
    update: () => flushSync(update),
    ...transition,
  });
}
