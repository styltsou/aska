const SHELLLESS_ROUTE_IDS = new Set(["/login", "/signup", "/onboarding", "/extension/connect"]);

export function shouldRenderWithoutAppShell(
  topLevelRouteId: string | undefined,
  committedPathname: string,
) {
  const route = topLevelRouteId ?? committedPathname.replace(/\/$/, "");
  return SHELLLESS_ROUTE_IDS.has(route);
}
