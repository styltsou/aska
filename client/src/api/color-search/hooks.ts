import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { hexToOklab } from "@/lib/oklab";

import { searchImagesByColor } from "./fetchers";
import type { ColorSearchScope } from "./types";

export const COLOR_SEARCH_DEBOUNCE_MS = 200;

export const colorSearchQueryKeys = {
  all: ["color-search"] as const,
  search: (workspaceSlug: string, scopeKey: string, colorSignature: string) =>
    [
      ...colorSearchQueryKeys.all,
      workspaceSlug,
      scopeKey,
      colorSignature,
    ] as const,
};

export function useColorImageSearch(
  workspaceSlug: string,
  scope: ColorSearchScope,
  selectedHexColors: readonly string[],
) {
  const colorSignature = selectedHexColors
    .map((color) => color.toLowerCase())
    .join(",");
  const debouncedColorSignature = useDebouncedValue(
    colorSignature,
    COLOR_SEARCH_DEBOUNCE_MS,
  );
  const scopeKey = toScopeKey(scope);
  const colors = useMemo(
    () =>
      debouncedColorSignature
        ? debouncedColorSignature.split(",").map(hexToOklab)
        : [],
    [debouncedColorSignature],
  );
  const query = useQuery({
    queryKey: colorSearchQueryKeys.search(
      workspaceSlug,
      scopeKey,
      debouncedColorSignature,
    ),
    queryFn: ({ signal }) =>
      searchImagesByColor(workspaceSlug, { colors, scope }, signal),
    enabled: colors.length > 0,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceSlug &&
      previousQuery.queryKey[2] === scopeKey
        ? keepPreviousData(previousData)
        : undefined,
  });

  return {
    ...query,
    isSearching:
      selectedHexColors.length > 0 &&
      (colorSignature !== debouncedColorSignature || query.isFetching),
  };
}

function toScopeKey(scope: ColorSearchScope): string {
  if (scope.type === "inbox") return "inbox";
  return [
    "collection",
    scope.collectionSlug,
    scope.folderPath ?? "",
    String(scope.includeDescendants),
  ].join(":");
}
