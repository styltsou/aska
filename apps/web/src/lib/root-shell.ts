const SHELLLESS_ROUTE_IDS = new Set([
  "/login",
  "/signup",
  "/onboarding",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
]);

export function shouldRenderWithoutAppShell(
  topLevelRouteId: string | undefined,
  committedPathname: string,
) {
  const route = topLevelRouteId ?? committedPathname.replace(/\/$/, "");
  return SHELLLESS_ROUTE_IDS.has(route);
}
