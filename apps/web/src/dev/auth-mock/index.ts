import { installMockFetch } from "./mock-server";

export { mockFetch } from "./mock-server";
import { mountToolbar } from "./toolbar";

/** True when the app was started with the mock auth backend, e.g. `bun run dev:auth-mock`. */
export const AUTH_MOCK_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCK === "true";

/**
 * Replaces the auth API with an in-browser mock and adds a small toolbar for
 * jumping between auth views. Call before the router loads its first route.
 */
export function installAuthMock(router: {
  navigate: (options: { href: string }) => unknown;
}) {
  installMockFetch();
  const mount = () => mountToolbar((href) => void router.navigate({ href }));
  if (document.body) mount();
  else window.addEventListener("DOMContentLoaded", mount, { once: true });
}
