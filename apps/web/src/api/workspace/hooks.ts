import { useQuery } from "@tanstack/react-query";
import { fetchWorkspace } from "./fetchers";
import type { WorkspaceData } from "./types";

const WORKSPACE_STALE_TIME = 60_000;

export function useWorkspace(workspaceSlug: string) {
  return useQuery<WorkspaceData>({
    queryKey: ["workspace", workspaceSlug],
    queryFn: () => fetchWorkspace(workspaceSlug),
    enabled: !!workspaceSlug,
    staleTime: WORKSPACE_STALE_TIME,
  });
}
