import { apiPost } from "@/lib/api";

export type ResolvedMediaUrl = {
  kind: "image" | "video";
  contentType: string;
};

export function resolveMediaUrl(workspaceSlug: string, url: string) {
  return apiPost<ResolvedMediaUrl>(
    `/api/v1/workspace/${encodeURIComponent(workspaceSlug)}/media/resolve`,
    { url },
  );
}
