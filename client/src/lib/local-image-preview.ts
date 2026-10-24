import type { QueryClient } from "@tanstack/react-query";

import type {
  CollectionContentsResponse,
  InboxContentsResponse,
} from "@/api/collection/types";

const releaseTimers = new Map<string, number>();

/** Keep shared upload previews through refetches and other open image views. */
export function releaseLocalImagePreviewAfterRemoteLoad(
  queryClient: QueryClient,
  previewUrl: string | undefined,
) {
  if (!previewUrl?.startsWith("blob:") || releaseTimers.has(previewUrl)) return;
  const timer = window.setTimeout(() => {
    releaseTimers.delete(previewUrl);
    queryClient.setQueriesData<
      CollectionContentsResponse | InboxContentsResponse
    >(
      {
        predicate: (query) =>
          query.queryKey[0] === "collectionContents" ||
          query.queryKey[0] === "inboxContents",
      },
      (current) =>
        current
          ? {
              ...current,
              nodes: current.nodes.map((node) =>
                node.type === "image" && node.localPreviewUrl === previewUrl
                  ? { ...node, localPreviewUrl: undefined }
                  : node,
              ),
            }
          : current,
    );
    requestAnimationFrame(() => URL.revokeObjectURL(previewUrl));
  }, 60_000);
  releaseTimers.set(previewUrl, timer);
}
