import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: () => {
    throw redirect({
      to: "/$workspaceSlug",
      params: { workspaceSlug: "personal" },
    });
  },
});
