import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateMentionSuggestionQueries,
  resolveCachedNoteMentions,
  mentionSearchQueryOptions,
} from "./hooks";
import { resolveNoteMentions, searchNoteMentions } from "./fetchers";
import type { NoteMentionTarget } from "./types";

vi.mock("./fetchers", () => ({
  resolveNoteMentions: vi.fn(),
  searchNoteMentions: vi.fn(),
}));

const target = (assetId: number): NoteMentionTarget => ({
  assetId,
  assetType: "color",
  label: `Color ${assetId}`,
  title: null,
  hex: "#123456",
  gradient: null,
  snippet: null,
  locationLabel: "Inbox",
  collectionSlug: null,
  folderPath: null,
});
const identity = (assetId: number) => ({
  assetId,
  assetType: "color" as const,
});

it("keeps active image results during invalidation and failure, and accepts a successful empty response", async () => {
  const client = new QueryClient();
  const options = mentionSearchQueryOptions("workspace", {
    q: "",
    types: ["image"],
    sourceAssetId: 10,
  });
  const image = { ...target(2), assetType: "image" as const };
  client.setQueryData(options.queryKey, { targets: [image] });
  let fail!: (error: Error) => void;
  vi.mocked(searchNoteMentions).mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      fail = reject;
    }),
  );
  const observer = new QueryObserver(client, { ...options, retry: false });
  const unsubscribe = observer.subscribe(() => {});
  const refresh = invalidateMentionSuggestionQueries(client, "workspace");
  expect(observer.getCurrentResult().isFetching).toBe(true);
  expect(observer.getCurrentResult().data?.targets).toEqual([image]);
  fail(new Error("Search unavailable"));
  await refresh;
  expect(observer.getCurrentResult().isError).toBe(true);
  expect(observer.getCurrentResult().data?.targets).toEqual([image]);
  vi.mocked(searchNoteMentions).mockResolvedValueOnce({ targets: [] });
  await observer.refetch();
  expect(observer.getCurrentResult().isSuccess).toBe(true);
  expect(observer.getCurrentResult().data?.targets).toEqual([]);
  unsubscribe();
  client.clear();
});

describe("mention resolution cache", () => {
  beforeEach(() => {
    vi.mocked(resolveNoteMentions).mockReset();
    vi.mocked(resolveNoteMentions).mockImplementation(
      async (_workspace, input) => ({
        targets: input.targets
          .filter((item) => item.assetId !== 3)
          .map((item) => target(item.assetId)),
      }),
    );
  });

  it("fetches only new identities, caches missing targets, and respects invalidation", async () => {
    const client = new QueryClient();
    const signal = new AbortController().signal;
    expect(
      await resolveCachedNoteMentions(
        client,
        "workspace",
        10,
        [identity(1), identity(3)],
        signal,
      ),
    ).toEqual([target(1)]);
    expect(
      await resolveCachedNoteMentions(
        client,
        "workspace",
        10,
        [identity(1), identity(2), identity(3)],
        signal,
      ),
    ).toEqual([target(1), target(2)]);
    expect(vi.mocked(resolveNoteMentions).mock.calls[1][1].targets).toEqual([
      identity(2),
    ]);
    await invalidateMentionSuggestionQueries(client, "workspace");
    await resolveCachedNoteMentions(
      client,
      "workspace",
      10,
      [identity(1), identity(2)],
      signal,
    );
    expect(vi.mocked(resolveNoteMentions).mock.calls[2][1].targets).toEqual([
      identity(1),
      identity(2),
    ]);
    await resolveCachedNoteMentions(client, "other", 10, [identity(1)], signal);
    await resolveCachedNoteMentions(
      client,
      "workspace",
      11,
      [identity(1)],
      signal,
    );
    expect(resolveNoteMentions).toHaveBeenCalledTimes(5);
    client.clear();
  });
});
