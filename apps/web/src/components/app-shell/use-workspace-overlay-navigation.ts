import { useCallback } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { WorkspaceRouteSearch } from "@/routes/$workspaceSlug/route";
import { mergeWorkspaceOverlaySearch } from "@/lib/workspace-overlay-search";
import {
  nextOverlayTrail,
  readOverlayTrail,
} from "@/lib/workspace-overlay-history";

export function useWorkspaceOverlayNavigation() {
  const navigate = useNavigate({ from: "/$workspaceSlug" });
  const router = useRouter();

  return useCallback(
    (
      pathname: string,
      searchPatch: Partial<WorkspaceRouteSearch> = {},
      replace = false,
    ) => {
      const location = router.state.location;
      const overlayTrail = nextOverlayTrail(
        location.pathname,
        pathname,
        readOverlayTrail(location.state),
        replace,
      );
      return navigate({
        to: pathname as "/$workspaceSlug",
        search: mergeWorkspaceOverlaySearch(
          location.search as WorkspaceRouteSearch,
          searchPatch,
        ),
        state: (previous) => ({ ...previous, overlayTrail }),
        replace,
      });
    },
    [navigate, router],
  );
}
