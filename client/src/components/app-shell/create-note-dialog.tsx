import type React from "react";

import type { BoardInsertionPlacement } from "@/api/collection";
import { NoteDetailDrawer } from "@/components/board/note-detail-drawer";

export function CreateNoteDialog({
  workspaceSlug,
  collectionPath,
  children,
  open,
  onOpenChange,
  initialContent = "",
  restoreOpen = false,
  target = "collection",
  placement,
}: {
  workspaceSlug: string;
  collectionPath: string;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialContent?: string;
  restoreOpen?: boolean;
  target?: "collection" | "inbox";
  placement?: BoardInsertionPlacement;
}) {
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const location =
    target === "inbox"
      ? ({ type: "inbox" } as const)
      : ({
          type: "collection",
          collectionSlug,
          folderPath: folderSegments.join("/") || undefined,
        } as const);

  return (
    <NoteDetailDrawer
      note={undefined}
      workspaceSlug={workspaceSlug}
      location={location}
      createOptions={{
        collectionPath,
        target,
        initialContent,
        restoreOpen,
        open,
        placement,
      }}
      onClose={() => onOpenChange?.(false)}
    >
      {children}
    </NoteDetailDrawer>
  );
}
