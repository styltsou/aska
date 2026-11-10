import { apiGet } from "@/lib/api";
import type { PexelsSearchResponse } from "./types";

export function searchPexels(
  workspaceSlug: string,
  query: string,
  page: number,
): Promise<PexelsSearchResponse> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    perPage: "24",
  });
  return apiGet<PexelsSearchResponse>(
    `/api/v1/workspace/${workspaceSlug}/pexels/search?${params}`,
  );
}
