import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { searchPexels } from "./fetchers";

export function usePexelsSearch(workspaceSlug: string, query: string) {
  return useInfiniteQuery({
    queryKey: ["pexelsSearch", workspaceSlug, query],
    queryFn: ({ pageParam }) => searchPexels(workspaceSlug, query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage) return 1;
      const loaded = lastPage.page * lastPage.perPage;
      return loaded < lastPage.totalResults ? lastPage.page + 1 : undefined;
    },
    enabled: query.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
