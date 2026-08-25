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
  return (
    <NoteDetailDrawer
      note={undefined}
      workspaceSlug={workspaceSlug}
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
