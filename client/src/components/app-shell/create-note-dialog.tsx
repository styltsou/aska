import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useCreateInboxNote, useCreateNote } from "@/api/collection";
import type { BoardInsertionPlacement } from "@/api/collection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  clearCreateNoteDraft,
  getCreateNoteDraftId,
  loadCreateNoteDraft,
  saveCreateNoteDraft,
} from "@/lib/create-note-draft";

const MAX_EDITOR_HEIGHT = 256;

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
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [content, setContent] = useState(initialContent);
  const [editorHeight, setEditorHeight] = useState<number>();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasRestoredOpenRef = useRef(false);
  const isInitialPageReloadRef = useRef(isPageReload());
  const draftId = useMemo(
    () => getCreateNoteDraftId(workspaceSlug, collectionPath, target),
    [collectionPath, target, workspaceSlug],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
    setEditorHeight(Math.min(textarea.scrollHeight, MAX_EDITOR_HEIGHT));
  }, [content, open]);

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

  function updateOpenState(nextOpen: boolean) {
    if (nextOpen) {
      const draft = loadCreateNoteDraft(draftId);
      setContent(initialContent || draft?.content || "");
    } else {
      setContent("");
      setError(null);
      clearCreateNoteDraft(draftId);
    }
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    updateOpenState(nextOpen);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("Write something before creating the note.");
      return;
    }

    const onError = (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Unable to create note.",
      );
    };

    if (target === "inbox") {
      createInboxNote.mutate({ content: trimmedContent }, { onError });
    } else {
      createNote.mutate(
        { content: trimmedContent, parentFolderPath, placement },
        { onError },
      );
    }
    updateOpenState(false);
  }

  function handleContentChange(nextContent: string) {
    setContent(nextContent);
    if (!nextContent) clearCreateNoteDraft(draftId);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger render={children} /> : null}
      <DialogContent className="max-w-md">
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New note</DialogTitle>
              <DialogDescription>
                {target === "inbox"
                  ? "Capture a text note in Inbox."
                  : "Add a text note to this board."}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea
              className="max-h-64 rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
              style={{ height: editorHeight }}
            >
              <textarea
                ref={textareaRef}
                autoComplete="off"
                autoFocus
                className="block min-h-16 w-full resize-none overflow-hidden bg-transparent px-2.5 py-2 pr-5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                placeholder="Enter to create, Shift+Enter for a new line"
                required
                value={content}
                onChange={(event) => handleContentChange(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </ScrollArea>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function isPageReload(): boolean {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === "reload";
}
