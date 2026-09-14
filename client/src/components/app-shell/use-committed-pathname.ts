import { useRouterState } from "@tanstack/react-router";

/**
 * Keep shell chrome aligned with the route currently rendered by the Outlet.
 * During navigation `location` is optimistic while `resolvedLocation` remains
 * the last committed route.
 */
export function useCommittedPathname() {
  return useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });
}
