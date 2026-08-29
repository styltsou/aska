import { apiGet, apiPost } from "@/lib/api";

import type {
  MentionResolveInput,
  MentionSearchInput,
  NoteMentionTargetsResponse,
} from "./types";

export function searchNoteMentions(
  workspaceSlug: string,
  input: MentionSearchInput,
  signal?: AbortSignal,
): Promise<NoteMentionTargetsResponse> {
  const query = new URLSearchParams();
  if (input.q) query.set("q", input.q);
  input.types?.forEach((type) => query.append("types", type));
  if (input.limit) query.set("limit", String(input.limit));
  if (input.sourceAssetId)
    query.set("sourceAssetId", String(input.sourceAssetId));
  return apiGet(
    `/api/v1/workspace/${workspaceSlug}/assets/mention-search?${query}`,
    { signal },
  );
}

export function resolveNoteMentions(
  workspaceSlug: string,
  input: MentionResolveInput,
  signal?: AbortSignal,
): Promise<NoteMentionTargetsResponse> {
  return apiPost(
    `/api/v1/workspace/${workspaceSlug}/assets/mention-resolve`,
    input,
    { signal },
  );
}
