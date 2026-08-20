import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { useCreateInboxNote, useCreateNote } from "@/api/collection";
import type { BoardInsertionPlacement } from "@/api/collection";
import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  clearCreateNoteDraft,
  getCreateNoteDraftId,
  loadCreateNoteDraft,
  saveCreateNoteDraft,
} from "@/lib/create-note-draft";

const NOTE_DRAWER_WIDTH = 800;
const NoteRichText = lazy(() =>
  import("@/components/board/note-rich-text").then((module) => ({
    default: module.NoteRichText,
  })),
);

export function CreateNoteDialog({
  workspaceSlug,
  collectionPath,
  children,
  open: controlledOpen,
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
  const parentFolderPath = folderSegments.join("/") || undefined;
  const createNote = useCreateNote(workspaceSlug, collectionSlug);
  const createInboxNote = useCreateInboxNote(workspaceSlug);
  const navigate = useNavigate();
  const editorRef = useRef<NoteRichTextHandle>(null);
  const hasRestoredOpenRef = useRef(false);
  const isInitialPageReloadRef = useRef(isPageReload());
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [content, setContent] = useState(initialContent);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftId = useMemo(
    () => getCreateNoteDraftId(workspaceSlug, collectionPath, target),
    [collectionPath, target, workspaceSlug],
  );
  const isPending = createNote.isPending || createInboxNote.isPending;
  const canSave = content.trim().length > 0 && !isPending;
  const isDirty = content.length > 0;

  useEffect(() => {
    if (!open) return;
    const draft = loadCreateNoteDraft(draftId);
    setContent(initialContent || draft?.content || "");
    setError(null);
  }, [draftId, initialContent, open]);

  useEffect(() => {
    if (!open || !content) return;
    saveCreateNoteDraft(draftId, { content, open: true });
  }, [content, draftId, open]);

  useEffect(() => {
    if (
      hasRestoredOpenRef.current ||
      !restoreOpen ||
      !isInitialPageReloadRef.current ||
      controlledOpen !== undefined
    ) {
      return;
    }
    hasRestoredOpenRef.current = true;

    const draft = loadCreateNoteDraft(draftId);
    if (!draft?.open) return;
    setContent(draft.content);
    setInternalOpen(true);
  }, [controlledOpen, draftId, restoreOpen]);

  function setOpen(nextOpen: boolean) {
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
  }

  function finishClose({ clearDraft = true } = {}) {
    if (clearDraft) clearCreateNoteDraft(draftId);
    setContent("");
    setError(null);
    setDiscardDialogOpen(false);
    setOpen(false);
  }

  function requestClose() {
    if (isDirty) {
      setDiscardDialogOpen(true);
      return;
    }
    finishClose();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const draft = loadCreateNoteDraft(draftId);
      setContent(initialContent || draft?.content || "");
      setError(null);
      setOpen(true);
      return;
    }
    requestClose();
  }

  function handleSave() {
    if (!canSave) {
      setError("Write something before saving the note.");
      return;
    }

    const noteContent = (editorRef.current?.getMarkdown() ?? content).trim();
    setError(null);

    const onSuccess = (data: { note: { id: string } }) => {
      clearCreateNoteDraft(draftId);
      finishClose();
      if (target === "inbox") {
        void navigate({
          to: "/$workspaceSlug/inbox",
          params: { workspaceSlug },
          search: { note: data.note.id, image: undefined },
        });
      } else {
        void navigate({
          to: "/$workspaceSlug/collections/$",
          params: { workspaceSlug, _splat: collectionPath },
          search: { note: data.note.id, image: undefined },
        });
      }
    };
    const onError = (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Unable to create note.";
      setError(message);
      toast.error(message);
    };

    if (target === "inbox") {
      createInboxNote.mutate({ content: noteContent }, { onSuccess, onError });
    } else {
      createNote.mutate(
        { content: noteContent, parentFolderPath, placement },
        { onSuccess, onError },
      );
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
        swipeDirection="right"
      >
        {children ? <DrawerTrigger render={children} /> : null}
        <DrawerContent
          className="rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl duration-200 [--bleed:0px] [--drawer-bleed-background:var(--sidebar)] [--drawer-inset:0.75rem] data-ending-style:duration-150 data-starting-style:duration-200"
          style={
            {
              "--drawer-content-width": `min(${NOTE_DRAWER_WIDTH}px, calc(100vw - 1.5rem))`,
            } as React.CSSProperties
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader className="flex-row items-center justify-between border-b border-sidebar-border p-4">
              <DrawerTitle className="text-sm">New note</DrawerTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  disabled={!canSave}
                  onClick={() => handleSave()}
                >
                  <CheckIcon />
                  <span>{isPending ? "Saving…" : "Save"}</span>
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={requestClose}>
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense
                fallback={
                  <div className="px-8 py-7 text-sm text-muted-foreground">
                    Opening editor…
                  </div>
                }
              >
                <NoteRichText
                  ref={editorRef}
                  markdown={content}
                  editable
                  autoFocus
                  onChange={(nextContent) => {
                    setContent(nextContent);
                    setError(null);
                    if (!nextContent) clearCreateNoteDraft(draftId);
                  }}
                  onSaveShortcut={() => handleSave()}
                />
              </Suspense>
            </div>
            {error ? (
              <p className="border-t border-sidebar-border px-4 py-2.5 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogBody>
            <AlertDialogHeader>
              <AlertDialogTitle>Save this note?</AlertDialogTitle>
              <AlertDialogDescription>
                Your draft will remain here if you continue writing.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogBody>
          <AlertDialogFooter className="sm:grid sm:grid-cols-3">
            <AlertDialogAction
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                finishClose();
              }}
            >
              Discard
            </AlertDialogAction>
            <AlertDialogCancel>Continue writing</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canSave}
              onClick={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              Save note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function isPageReload(): boolean {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === "reload";
}
