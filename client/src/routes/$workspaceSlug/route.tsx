import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$workspaceSlug")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
