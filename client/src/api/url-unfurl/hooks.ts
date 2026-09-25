import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createInboxLink,
  createLink,
  refreshLink,
} from "@/api/collection/fetchers";
import { collectionQueryKeys } from "@/api/collection/query-keys";
import type {
  BoardInsertionPlacement,
  CollectionContentsResponse,
  CollectionLinkNode,
  CreateLinkInput,
  InboxContentsResponse,
} from "@/api/collection/types";
import { reserveNodePositions } from "@/components/canvas/canvas-node-layout";
import { extractYouTubeVideoId } from "@/lib/youtube-url";
import {
  patchLinkInCaches,
  trackLinkResolution,
} from "./link-resolution-poller";

type CreateLinkMutationInput = CreateLinkInput & {
  placement?: BoardInsertionPlacement;
};

type YouTubeOEmbedMetadata = { title: string; channelName: string | null };

const YOUTUBE_OEMBED_ORIGIN = "https://www.youtube.com";

function youtubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function createOptimisticLink(
  url: string,
  id: string,
): CollectionLinkNode {
  const parsed = new URL(url);
  const videoId = extractYouTubeVideoId(url);
  return {
    id,
    type: "link",
    originalUrl: url,
    canonicalUrl: null,
    hostname: parsed.hostname,
    title: parsed.hostname,
    description: null,
    note: null,
    siteName: videoId ? "YouTube" : null,
    resourceKind: videoId ? "video" : "web_page",
    resolutionStatus: "queued",
    failureCategory: null,
    resolvedAt: null,
    staleAt: null,
    previewImage: videoId
      ? {
          url: youtubeThumbnailUrl(videoId),
          width: 480,
          height: 360,
          alt: null,
        }
      : null,
    favicon: null,
    video: null,
    ...(videoId
      ? {
          optimisticYouTube: {
            videoId,
            channelName: null,
            metadataStatus: "loading" as const,
          },
        }
      : {}),
    createdAt: new Date().toISOString(),
    clientId: id,
    position: null,
  };
}

async function fetchYouTubeOEmbed(
  videoId: string,
  signal: AbortSignal,
): Promise<YouTubeOEmbedMetadata> {
  const endpoint = new URL("/oembed", YOUTUBE_OEMBED_ORIGIN);
  endpoint.searchParams.set(
    "url",
    `${YOUTUBE_OEMBED_ORIGIN}/watch?v=${videoId}`,
  );
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error("YouTube oEmbed request failed");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid YouTube oEmbed response");
  const data = payload as { title?: unknown; author_name?: unknown };
  const title = boundedText(data.title, 255);
  if (!title) throw new Error("Invalid YouTube oEmbed response");
  return { title, channelName: boundedText(data.author_name, 255) };
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function isActiveResolution(status: CollectionLinkNode["resolutionStatus"]) {
  return status === "queued" || status === "resolving";
}

function patchOptimisticYouTubeMetadata(
  queryClient: ReturnType<typeof useQueryClient>,
  key: QueryKey,
  clientId: string,
  metadata: YouTubeOEmbedMetadata,
) {
  queryClient.setQueryData<{ nodes: CollectionLinkNode[] }>(key, (current) => {
    if (!current) return current;
    let changed = false;
    const nodes = current.nodes.map((node) => {
      if (
        node.type !== "link" ||
        node.clientId !== clientId ||
        !node.optimisticYouTube ||
        !isActiveResolution(node.resolutionStatus)
      )
        return node;
      changed = true;
      return {
        ...node,
        title: metadata.title,
        optimisticYouTube: {
          ...node.optimisticYouTube,
          channelName: metadata.channelName,
          metadataStatus: "ready" as const,
        },
      };
    });
    return changed ? { ...current, nodes } : current;
  });
}

function reconcileOptimisticYouTubeLink(
  link: CollectionLinkNode,
  previous: CollectionLinkNode,
  clientId: string,
): CollectionLinkNode {
  if (!previous.optimisticYouTube || !isActiveResolution(link.resolutionStatus))
    return { ...link, clientId };
  return {
    ...link,
    clientId,
    title: previous.title,
    siteName: previous.siteName,
    previewImage: previous.previewImage,
    optimisticYouTube: previous.optimisticYouTube,
  };
}

function startOptimisticYouTubeOEmbed(
  queryClient: ReturnType<typeof useQueryClient>,
  key: QueryKey,
  url: string,
  clientId: string,
) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return undefined;
  const controller = new AbortController();
  void fetchYouTubeOEmbed(videoId, controller.signal)
    .then((metadata) =>
      patchOptimisticYouTubeMetadata(queryClient, key, clientId, metadata),
    )
    .catch(() => {
      // Server resolution remains authoritative; browser oEmbed is optional.
    });
  return controller;
}

export function useCreateLink(workspaceSlug: string, collectionSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: CreateLinkMutationInput) => {
      const key = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
      );
      const current = queryClient.getQueryData<CollectionContentsResponse>(key);
      const placeholder = createOptimisticLink(variables.url, "link-pending");
      const position = reserveNodePositions(
        current?.nodes ?? [],
        [placeholder],
        variables.placement ?? variables.position,
      )[0];
      return createLink(workspaceSlug, collectionSlug, {
        url: variables.url,
        parentFolderPath: variables.parentFolderPath,
        position,
      });
    },
    onMutate: async (variables) => {
      const key = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
      );
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<CollectionContentsResponse>(key);
      const id = `link-optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const link = createOptimisticLink(variables.url, id);
      link.position =
        reserveNodePositions(
          previous?.nodes ?? [],
          [link],
          variables.placement ?? variables.position,
        )[0] ?? null;
      queryClient.setQueryData<CollectionContentsResponse>(key, (current) =>
        current ? { ...current, nodes: [...current.nodes, link] } : current,
      );
      return {
        key,
        previous,
        id,
        oembedController: startOptimisticYouTubeOEmbed(
          queryClient,
          key,
          variables.url,
          id,
        ),
      };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        context.oembedController?.abort();
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSuccess: (data, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData<CollectionContentsResponse>(
        context.key,
        (current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.map((node) =>
                  node.type === "link" && node.id === context.id
                    ? {
                        ...reconcileOptimisticYouTubeLink(
                          data.link,
                          node,
                          context.id,
                        ),
                        position: data.link.position ?? node.position,
                      }
                    : node,
                ),
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
      trackLinkResolution(workspaceSlug, data.link);
    },
  });
}

export function useCreateInboxLink(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: CreateLinkMutationInput) =>
      createInboxLink(workspaceSlug, { url: variables.url }),
    onMutate: async (variables) => {
      const key = collectionQueryKeys.inbox(workspaceSlug);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<InboxContentsResponse>(key);
      const id = `link-optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const link = createOptimisticLink(variables.url, id);
      queryClient.setQueryData<InboxContentsResponse>(key, (current) =>
        current
          ? { ...current, nodes: [link, ...current.nodes] }
          : {
              collection: { id: 0, name: "Inbox", slug: "inbox" },
              breadcrumbs: [],
              nodes: [link],
            },
      );
      return {
        key,
        previous,
        id,
        oembedController: startOptimisticYouTubeOEmbed(
          queryClient,
          key,
          variables.url,
          id,
        ),
      };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        context.oembedController?.abort();
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSuccess: (data, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData<InboxContentsResponse>(context.key, (current) =>
        current
          ? {
              ...current,
              nodes: current.nodes.map((node) =>
                node.type === "link" && node.id === context.id
                  ? reconcileOptimisticYouTubeLink(data.link, node, context.id)
                  : node,
              ),
            }
          : current,
      );
      void queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceSlug],
      });
      trackLinkResolution(workspaceSlug, data.link);
    },
  });
}

export function useRefreshLink(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => refreshLink(workspaceSlug, assetId),
    onSuccess: (data) => {
      patchLinkInCaches(queryClient, workspaceSlug, data.link);
      trackLinkResolution(workspaceSlug, data.link);
    },
  });
}
