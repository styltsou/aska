import { createFileRoute, notFound } from "@tanstack/react-router";
import { parseWorkspaceAssetId } from "@/lib/workspace-asset-url";

export const Route = createFileRoute("/$workspaceSlug/asset/$assetId")({
  beforeLoad: ({ params }) => {
    if (!parseWorkspaceAssetId(params.assetId)) throw notFound();
  },
  component: () => null,
});
