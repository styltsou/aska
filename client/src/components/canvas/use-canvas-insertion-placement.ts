import { useMemo } from "react";
import type { BoardInsertionPlacement } from "@/api/collection";
import { useTransientStore } from "@/store";

import { makeBoardKey } from "./canvas-key";

export function useBoardInsertionPlacement(
  workspaceSlug: string | undefined,
  collectionPath: string,
): BoardInsertionPlacement | undefined {
  const boardKey = useMemo(() => {
    const [collectionSlug = "", ...folderSegments] = collectionPath
      .split("/")
      .filter(Boolean);

    return workspaceSlug && collectionSlug
      ? makeBoardKey(
          workspaceSlug,
          collectionSlug,
          folderSegments.join("/") || undefined,
        )
      : undefined;
  }, [collectionPath, workspaceSlug]);
  const visibleBounds = useTransientStore((state) =>
    boardKey ? state.boardVisibleBounds[boardKey] : undefined,
  );

  return useMemo(
    () => (visibleBounds ? { visibleBounds } : undefined),
    [visibleBounds],
  );
}
