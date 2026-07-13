import React, { useState } from "react";
import { FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { useCreateInboxNote, useCreateNote } from "@/api/collection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateNoteDialog({
  workspaceSlug,
  collectionPath,
  children,
  open: controlledOpen,
  onOpenChange,
  initialContent = "",
  target = "collection",
}: {
  workspaceSlug: string;
  collectionPath: string;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialContent?: string;
  target?: "collection" | "inbox";
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
  const [error, setError] = useState<string | null>(null);
  const isSubmitting =
    target === "inbox" ? createInboxNote.isPending : createNote.isPending;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setContent(initialContent);
    } else {
      setContent("");
      setError(null);
      createNote.reset();
      createInboxNote.reset();
    }
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("Write something before creating the note.");
      return;
    }

    try {
      if (target === "inbox") {
        await createInboxNote.mutateAsync({
          content: trimmedContent,
        });
      } else {
        await createNote.mutateAsync({
          content: trimmedContent,
          parentFolderPath,
        });
      }
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create note.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger render={children} /> : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>
            {target === "inbox"
              ? "Capture a text note in Inbox."
              : "Add a text note to this board."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="note-content">
              Note
            </label>
            <textarea
              autoComplete="off"
              autoFocus
              className="min-h-32 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm leading-6 transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30"
              disabled={isSubmitting}
              id="note-content"
              required
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <FileTextIcon />
              )}
              <span>{isSubmitting ? "Creating" : "Create note"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
