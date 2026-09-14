import { useEffect, useRef } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";

import { fetchLinkResolutionStatus } from "@/api/collection/fetchers";
import type {
  CollectionContentsResponse,
  CollectionLinkNode,
  InboxContentsResponse,
} from "@/api/collection/types";
import { ApiError } from "@/lib/api";
import { useLinkResolutionTracker } from "./link-resolution-tracker";

const ACTIVE_STATUSES = new Set(["queued", "resolving"]);
const EMPTY_PENDING_LINK_IDS: readonly string[] = [];

function linkResolutionQueryKey(workspaceSlug: string, assetId: string) {
  return ["linkResolution", workspaceSlug, assetId] as const;
}

/** Polls only links created or manually refreshed in this browser tab. */
export function LinkResolutionPoller({
  workspaceSlug,
}: {
  workspaceSlug?: string;
}) {
  const queryClient = useQueryClient();
  const assetIds = useLinkResolutionTracker((state) =>
    workspaceSlug
      ? (state.pendingByWorkspace[workspaceSlug] ?? EMPTY_PENDING_LINK_IDS)
      : EMPTY_PENDING_LINK_IDS,
  );
  const untrack = useLinkResolutionTracker((state) => state.untrack);
  const applied = useRef(new Map<string, string>());
  const results = useQueries({
    queries: assetIds.map((assetId) => ({
      queryKey: linkResolutionQueryKey(workspaceSlug!, assetId),
      queryFn: () => fetchLinkResolutionStatus(workspaceSlug!, assetId),
      enabled: Boolean(workspaceSlug),
      staleTime: 0,
      refetchInterval: (query: { state: { data?: CollectionLinkNode } }) =>
        query.state.data && !isActive(query.state.data) ? false : 1_000,
      refetchIntervalInBackground: false,
    })),
  });

  useEffect(() => {
    if (!workspaceSlug) return;
    for (const [index, result] of results.entries()) {
      const link = result.data;
      if (!link) {
        if (isPermanentStatusError(result.error)) {
          untrack(workspaceSlug, assetIds[index]!);
        }
        continue;
      }
      const signature = linkSignature(link);
      if (applied.current.get(link.id) !== signature) {
        patchLinkInCaches(queryClient, workspaceSlug, link);
        applied.current.set(link.id, signature);
      }
      if (!isActive(link)) {
        untrack(workspaceSlug, link.id);
        applied.current.delete(link.id);
      }
    }
  }, [assetIds, queryClient, results, untrack, workspaceSlug]);

  return null;
}

export function trackLinkResolution(
  workspaceSlug: string,
  link: Pick<CollectionLinkNode, "id" | "resolutionStatus">,
) {
  if (isActive(link))
    useLinkResolutionTracker.getState().track(workspaceSlug, link.id);
}

export function patchLinkInCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  link: CollectionLinkNode,
) {
  queryClient.setQueriesData<CollectionContentsResponse>(
    { queryKey: ["collectionContents", workspaceSlug] },
    (current) => patchCollectionContents(current, link),
  );
  queryClient.setQueriesData<InboxContentsResponse>(
    { queryKey: ["inboxContents", workspaceSlug] },
    (current) => patchCollectionContents(current, link),
  );
}

function patchCollectionContents<
  T extends { nodes: Array<CollectionContentsResponse["nodes"][number]> },
>(current: T | undefined, link: CollectionLinkNode): T | undefined {
  if (!current) return current;
  let changed = false;
  const nodes = current.nodes.map((node) => {
    if (node.type !== "link" || node.id !== link.id) return node;
    changed = true;
    return {
      ...node,
      canonicalUrl: link.canonicalUrl,
      hostname: link.hostname,
      title: link.title,
      description: link.description,
      siteName: link.siteName,
      resourceKind: link.resourceKind,
      resolutionStatus: link.resolutionStatus,
      failureCategory: link.failureCategory,
      resolvedAt: link.resolvedAt,
      staleAt: link.staleAt,
      previewImage: link.previewImage,
      favicon: link.favicon,
      video: link.video,
    };
  });
  return changed ? { ...current, nodes } : current;
}

function isActive(link: Pick<CollectionLinkNode, "resolutionStatus">) {
  return ACTIVE_STATUSES.has(link.resolutionStatus);
}

function linkSignature(link: CollectionLinkNode) {
  return JSON.stringify([
    link.resolutionStatus,
    link.failureCategory,
    link.resolvedAt,
    link.staleAt,
    link.title,
    link.description,
    link.siteName,
    link.previewImage
      ? [
          link.previewImage.width,
          link.previewImage.height,
          link.previewImage.alt,
        ]
      : null,
    link.favicon ? [link.favicon.width, link.favicon.height] : null,
  ]);
}

function isPermanentStatusError(error: unknown) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}
