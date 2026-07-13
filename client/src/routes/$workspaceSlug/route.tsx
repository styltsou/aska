import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireWorkspace } from "@/lib/auth-flow";

export const Route = createFileRoute("/$workspaceSlug")({
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
  return <Outlet />;
}
