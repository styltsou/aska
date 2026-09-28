import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { requireWorkspace } from "@/lib/auth-flow";
import {
  parseWorkspaceAssetId,
  parseWorkspaceAssetPath,
} from "@/lib/workspace-asset-url";
import { WorkspacePage } from "./index";

export type WorkspaceRouteSearch = {
  asset?: string;
  peek?: string;
  view?: "modal" | "full";
  peekScope?: string;
  peekDescendants?: boolean;
  settings?: boolean;
};

export const Route = createFileRoute("/$workspaceSlug")({
  validateSearch: (search): WorkspaceRouteSearch => ({
    asset: parseWorkspaceAssetId(search.asset),
    peek: parseWorkspaceAssetId(search.peek),
    view:
      search.view === "modal" || search.view === "full"
        ? search.view
        : undefined,
    peekScope:
      typeof search.peekScope === "string" ? search.peekScope : undefined,
    peekDescendants:
      search.peekDescendants === true ||
      search.peekDescendants === "true" ||
      search.peekDescendants === "1" ||
      undefined,
    settings:
      search.settings === true || search.settings === "true" || undefined,
  }),
  beforeLoad: async ({ location, params }) => {
    return requireWorkspace(location, params.workspaceSlug);
  },
  pendingComponent: WorkspacePending,
  component: WorkspaceLayout,
});

function WorkspacePending() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="size-5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
      <p className="text-sm text-muted-foreground">Loading your workspace</p>
    </div>
  );
}

function WorkspaceLayout() {
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });
  const { workspaceSlug } = Route.useParams();
  if (parseWorkspaceAssetPath(pathname).boardPathname === `/${workspaceSlug}`) {
    return <WorkspacePage />;
  }
  return <Outlet />;
}
