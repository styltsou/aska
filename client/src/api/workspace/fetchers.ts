import { apiGet } from "@/lib/api";
import type { WorkspaceData } from "./types";

export async function fetchWorkspace(slug: string): Promise<WorkspaceData> {
  return apiGet<WorkspaceData>(`/api/v1/workspace/${slug}`);
}
