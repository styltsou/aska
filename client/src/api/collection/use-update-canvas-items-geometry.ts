import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateCanvasItemsGeometry } from "./fetchers";
import type {
  CollectionContentsResponse,
  UpdateCanvasItemsGeometryInput,
} from "./types";
import { collectionQueryKeys } from "./query-keys";

export function useUpdateCanvasItemsGeometry(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();
  const scope = collectionQueryKeys.contentScope(workspaceSlug, collectionSlug);
  return useMutation({
    mutationFn: (input: UpdateCanvasItemsGeometryInput) =>
      updateCanvasItemsGeometry(workspaceSlug, collectionSlug, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: scope });
      const previous = queryClient
        .getQueriesData<CollectionContentsResponse>({ queryKey: scope })
        .filter(([key]) => key[3] === input.folderPath);
      const updates = new Map(input.items.map((item) => [item.id, item]));
      for (const [key, contents] of previous) {
        if (!contents) continue;
        queryClient.setQueryData<CollectionContentsResponse>(key, {
          ...contents,
          nodes: contents.nodes.map((node) => {
            const update = updates.get(node.id);
            return update?.type === "node"
              ? { ...node, position: update.position }
              : node;
          }),
          canvasObjects: contents.canvasObjects.map((object) => {
            const update = updates.get(object.id);
            if (update?.type === "text" && object.type === "text") {
              return { ...object, position: update.position };
            }
            if (update?.type === "arrow" && object.type === "arrow") {
              return {
                ...object,
                start: update.start,
                end: update.end,
                points: update.points,
                rotation: update.rotation,
              };
            }
            return object;
          }),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      for (const [key, contents] of context?.previous ?? []) {
        queryClient.setQueryData(key, contents);
      }
      toast.error("Unable to save the selection's position.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scope });
    },
  });
}
