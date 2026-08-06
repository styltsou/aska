import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchPexels } from "./fetchers";

export function usePexelsSearch(
  workspaceSlug: string,
  query: string,
  page: number,
) {
  return useQuery({
    queryKey: ["pexelsSearch", workspaceSlug, query, page],
    queryFn: () => searchPexels(workspaceSlug, query, page),
    enabled: query.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
