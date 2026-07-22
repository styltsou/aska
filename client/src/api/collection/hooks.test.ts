import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { collectionQueryKeys } from "./hooks";

describe("collection query keys", () => {
  it("invalidates cached counts at every folder level in one collection", async () => {
    const queryClient = new QueryClient();
    const rootKey = collectionQueryKeys.contents("personal", "reference");
    const nestedKey = collectionQueryKeys.contents(
      "personal",
      "reference",
      "type/serif",
    );
    const otherCollectionKey = collectionQueryKeys.contents(
      "personal",
      "inspiration",
    );

    queryClient.setQueryData(rootKey, { nodes: [] });
    queryClient.setQueryData(nestedKey, { nodes: [] });
    queryClient.setQueryData(otherCollectionKey, { nodes: [] });

    await queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.contentScope("personal", "reference"),
      refetchType: "none",
    });

    expect(queryClient.getQueryState(rootKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(nestedKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherCollectionKey)?.isInvalidated).toBe(
      false,
    );
  });
});
