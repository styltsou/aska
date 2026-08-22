import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { hexToOklab } from "@/lib/oklab";

import { searchImagesByColor } from "./fetchers";
import type {
  ColorSearchInput,
  ColorSearchMatchMode,
  ColorSearchScope,
} from "./types";

export const COLOR_SEARCH_DEBOUNCE_MS = 200;

export const colorSearchQueryKeys = {
  all: ["color-search"] as const,
  search: (
    workspaceSlug: string,
    scopeKey: string,
    colorSignature: string,
    matchMode: ColorSearchMatchMode,
  ) =>
    [
      ...colorSearchQueryKeys.all,
      workspaceSlug,
      scopeKey,
      colorSignature,
      matchMode,
    ] as const,
};

export function useColorImageSearch(
  workspaceSlug: string,
  scope: ColorSearchScope,
  selectedHexColors: readonly string[],
) {
  const colors = useMemo(
    () => selectedHexColors.map(hexToOklab),
    [selectedHexColors],
  );
  return useColorSearch(workspaceSlug, scope, colors, "strict");
}

export function useWeightedColorImageSearch(
  workspaceSlug: string,
  scope: ColorSearchScope,
  colors: ReadonlyArray<ColorSearchInput["colors"][number]>,
) {
  return useColorSearch(workspaceSlug, scope, colors, "weighted");
}

function useColorSearch(
  workspaceSlug: string,
  scope: ColorSearchScope,
  colors: ReadonlyArray<ColorSearchInput["colors"][number]>,
  matchMode: ColorSearchMatchMode,
) {
  const colorSignature = colors
    .map(
      (color) =>
        `${color.oklabL.toFixed(6)}:${color.oklabA.toFixed(6)}:${color.oklabB.toFixed(6)}:${color.weight ?? 1}`,
    )
    .join(",");
  const debouncedColorSignature = useDebouncedValue(
    colorSignature,
    COLOR_SEARCH_DEBOUNCE_MS,
  );
  const scopeKey = toScopeKey(scope);
  const debouncedColors = useMemo(
    () => (debouncedColorSignature === colorSignature ? colors : []),
    [colorSignature, colors, debouncedColorSignature],
  );
  const query = useQuery({
    queryKey: colorSearchQueryKeys.search(
      workspaceSlug,
      scopeKey,
      debouncedColorSignature,
      matchMode,
    ),
    queryFn: ({ signal }) =>
      searchImagesByColor(
        workspaceSlug,
        { colors: debouncedColors, scope, matchMode },
        signal,
      ),
    enabled: debouncedColors.length > 0,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceSlug &&
      previousQuery.queryKey[2] === scopeKey
        ? keepPreviousData(previousData)
        : undefined,
  });

  return {
    ...query,
    isSearching:
      colors.length > 0 &&
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
