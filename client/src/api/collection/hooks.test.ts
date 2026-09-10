import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { colorSearchQueryKeys } from "@/api/color-search/hooks";

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

describe("color search query keys", () => {
  it("invalidates color-search results only for the affected workspace", async () => {
    const queryClient = new QueryClient();
    const personalKey = colorSearchQueryKeys.search(
      "personal",
      "inbox",
      "0.5:0.1:0.2:1",
      "weighted",
    );
    const sharedKey = colorSearchQueryKeys.search(
      "shared",
      "inbox",
      "0.5:0.1:0.2:1",
      "weighted",
    );

    queryClient.setQueryData(personalKey, { results: [] });
    queryClient.setQueryData(sharedKey, { results: [] });

    await queryClient.invalidateQueries({
      queryKey: colorSearchQueryKeys.workspace("personal"),
      refetchType: "none",
    });

    expect(queryClient.getQueryState(personalKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(sharedKey)?.isInvalidated).toBe(false);
  });
});
