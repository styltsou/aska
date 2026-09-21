import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type {
  CanvasObjectResponse,
  CollectionContentsResponse,
  UpdateCanvasTextInput,
} from "./types";
import {
  createCanvasObjectUpdateQueue,
  updateFrontIndexesInContents,
} from "./canvas-object-hooks";

const contents: CollectionContentsResponse = {
  collection: { id: 1, name: "Ideas", slug: "ideas" },
  breadcrumbs: [],
  nodes: [
    {
      id: "note-1",
      type: "note",
      content: "Card",
      isFavorite: false,
      wordCount: 1,
      readingTimeMinutes: 1,
      createdAt: "2026-09-15T00:00:00.000Z",
      position: { x: 0, y: 0 },
      frontIndex: null,
    },
  ],
  canvasObjects: [
    {
      id: "text-2",
      type: "text",
      content: "Label",
      position: { x: 10, y: 10 },
      font: "inter",
      size: "md",
      color: "ink",
      frontIndex: null,
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    },
    {
      id: "arrow-3",
      type: "arrow",
      start: { position: { x: 0, y: 0 } },
      end: { position: { x: 20, y: 20 } },
      style: "clean",
      pattern: "solid",
      head: "filled",
      routing: "straight",
      points: [],
      color: "ink",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const contentsKey = [
  "collectionContents",
  "workspace",
  "ideas",
  undefined,
] as const;

function textObject(update: UpdateCanvasTextInput = {}): CanvasObjectResponse {
  const object = contents.canvasObjects[0];
  if (!object || object.type !== "text") {
    throw new Error("Expected the text fixture first");
  }
  return {
    object: {
      ...object,
      ...update,
    },
  };
}

function createTextUpdateQueue(
  queryClient: QueryClient,
  save: (
    objectId: string,
    patch: UpdateCanvasTextInput,
  ) => Promise<CanvasObjectResponse>,
) {
  return createCanvasObjectUpdateQueue({
    queryClient,
    filter: {
      predicate: (query) =>
        query.queryKey[0] === "collectionContents" &&
        query.queryKey[1] === "workspace" &&
        query.queryKey[2] === "ideas" &&
        query.queryKey[3] === undefined,
    },
    objectType: "text",
    save,
  });
}

describe("canvas front-index cache updates", () => {
  it("updates collection nodes and text while leaving arrows untouched", () => {
    const updated = updateFrontIndexesInContents(contents, [
      { id: "note-1", frontIndex: 4 },
      { id: "text-2", frontIndex: 5 },
      { id: "arrow-3", frontIndex: 6 },
    ]);

    expect(updated?.nodes[0]?.frontIndex).toBe(4);
    expect(updated?.canvasObjects[0]).toMatchObject({ frontIndex: 5 });
    expect(updated?.canvasObjects[1]).toBe(contents.canvasObjects[1]);
  });
});

describe("canvas object update queue", () => {
  it("keeps the newest optimistic fields while an older response settles", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(contentsKey, contents);
    const first = deferred<CanvasObjectResponse>();
    const latest = deferred<CanvasObjectResponse>();
    const save = vi
      .fn<
        (
          objectId: string,
          patch: UpdateCanvasTextInput,
        ) => Promise<CanvasObjectResponse>
      >()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(latest.promise);
    const updates = createTextUpdateQueue(queryClient, save);

    const firstResult = updates.enqueue("text-2", {
      font: "ibm_plex_mono",
    });
    const latestResult = updates.enqueue("text-2", {
      font: "fraunces",
      color: "violet",
    });

    expect(
      queryClient.getQueryData<CollectionContentsResponse>(contentsKey)
        ?.canvasObjects[0],
    ).toMatchObject({ font: "fraunces", color: "violet" });

    first.resolve(textObject({ font: "ibm_plex_mono" }));
    await firstResult;

    expect(
      queryClient.getQueryData<CollectionContentsResponse>(contentsKey)
        ?.canvasObjects[0],
    ).toMatchObject({ font: "fraunces", color: "violet" });
    expect(save).toHaveBeenLastCalledWith("text-2", {
      font: "fraunces",
      color: "violet",
    });

    latest.resolve(textObject({ font: "fraunces", color: "violet" }));
    await latestResult;

    expect(
      queryClient.getQueryData<CollectionContentsResponse>(contentsKey)
        ?.canvasObjects[0],
    ).toMatchObject({ font: "fraunces", color: "violet" });
  });

  it("restores the last confirmed object when the final patch fails", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(contentsKey, contents);
    const first = deferred<CanvasObjectResponse>();
    const latest = deferred<CanvasObjectResponse>();
    const save = vi
      .fn<
        (
          objectId: string,
          patch: UpdateCanvasTextInput,
        ) => Promise<CanvasObjectResponse>
      >()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(latest.promise);
    const updates = createTextUpdateQueue(queryClient, save);

    const firstResult = updates.enqueue("text-2", { size: "lg" });
    const latestResult = updates.enqueue("text-2", { size: "xl" });

    first.resolve(textObject({ size: "lg" }));
    await firstResult;
    latest.reject(new Error("save failed"));
    await expect(latestResult).rejects.toThrow("save failed");

    expect(
      queryClient.getQueryData<CollectionContentsResponse>(contentsKey)
        ?.canvasObjects[0],
    ).toMatchObject({ size: "lg" });
  });

  it("does not reinsert an object deleted while its update is pending", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(contentsKey, contents);
    const request = deferred<CanvasObjectResponse>();
    const updates = createTextUpdateQueue(queryClient, () => request.promise);

    const result = updates.enqueue("text-2", { color: "violet" });
    queryClient.setQueryData<CollectionContentsResponse>(
      contentsKey,
      (current) =>
        current && {
          ...current,
          canvasObjects: current.canvasObjects.filter(
            (object) => object.id !== "text-2",
          ),
        },
    );
    request.resolve(textObject({ color: "violet" }));
    await result;

    expect(
      queryClient
        .getQueryData<CollectionContentsResponse>(contentsKey)
        ?.canvasObjects.some((object) => object.id === "text-2"),
    ).toBe(false);
  });
});
