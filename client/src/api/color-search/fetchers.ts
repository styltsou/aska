import { apiPost } from "@/lib/api";

import type { ColorSearchInput, ColorSearchResponse } from "./types";

export function searchImagesByColor(
  workspaceSlug: string,
  input: ColorSearchInput,
  signal?: AbortSignal,
): Promise<ColorSearchResponse> {
  return apiPost<ColorSearchResponse>(
    `/api/v1/workspace/${workspaceSlug}/images/search`,
    input,
    { signal },
  );
}
