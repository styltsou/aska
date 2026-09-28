import { createFileRoute, notFound } from "@tanstack/react-router";
import { parseWorkspaceAssetPath } from "@/lib/workspace-asset-url";

/** Keeps the inbox board mounted while its asset suffix changes. */
export const Route = createFileRoute("/$workspaceSlug/inbox/$")({
  beforeLoad: ({ location }) => {
    if (!parseWorkspaceAssetPath(location.pathname).assetId) throw notFound();
  },
  component: () => null,
});
