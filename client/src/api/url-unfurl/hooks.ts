import { useMutation, useQueryClient } from "@tanstack/react-query";

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

type CreateLinkMutationInput = CreateLinkInput & {
  placement?: BoardInsertionPlacement;
};

export function createOptimisticLink(
  url: string,
  id: string,
): CollectionLinkNode {
  const parsed = new URL(url);
  return {
    id,
    type: "link",
    originalUrl: url,
    canonicalUrl: null,
    hostname: parsed.hostname,
    title: parsed.hostname,
    description: null,
    note: null,
    siteName: null,
    resourceKind: "web_page",
    resolutionStatus: "queued",
    failureCategory: null,
    resolvedAt: null,
    staleAt: null,
    previewImage: null,
    favicon: null,
    video: null,
    createdAt: new Date().toISOString(),
    clientId: id,
    position: null,
  };
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
      return { key, previous, id };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
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
                  node.id === context.id
                    ? {
                        ...data.link,
                        clientId: context.id,
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
      return { key, previous, id };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSuccess: (data, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData<InboxContentsResponse>(context.key, (current) =>
        current
          ? {
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === context.id
                  ? { ...data.link, clientId: context.id }
                  : node,
              ),
            }
          : current,
      );
      void queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceSlug],
      });
    },
  });
}

export function useRefreshLink(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => refreshLink(workspaceSlug, assetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["collectionContents", workspaceSlug],
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.inbox(workspaceSlug),
      });
    },
  });
}

export function activeLinkRefetchInterval(data: unknown): number | false {
  const response = data as CollectionContentsResponse | undefined;
  return response?.nodes.some(
    (node) =>
      node.type === "link" &&
      (node.resolutionStatus === "queued" ||
        node.resolutionStatus === "resolving"),
  )
    ? 1_500
    : false;
}
