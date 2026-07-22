import React, { useMemo, useState } from "react";
import { useCreateFolder } from "@/api/collection";
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
import { Input } from "@/components/ui/input";
import { LoaderCircleIcon } from "lucide-react";
import { slugFromTitle } from "@/lib/slug";

export function CreateFolderDialog({
  workspaceSlug,
  collectionPath,
  children,
  open: controlledOpen,
  onOpenChange,
  placement,
}: {
  workspaceSlug: string;
  collectionPath: string;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: BoardInsertionPlacement;
}) {
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const createFolder = useCreateFolder(workspaceSlug, collectionSlug);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const slug = useMemo(() => slugFromTitle(name), [name]);
  const isSubmitting = createFolder.isPending;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setError(null);
      createFolder.reset();
    }
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!slug) {
      setError("Use a folder name with at least one letter or number.");
      return;
    }

    try {
      await createFolder.mutateAsync({
        name,
        parentFolderPath,
        placement,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create folder.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger render={children} /> : null}
      <DialogContent>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New folder</DialogTitle>
              <DialogDescription>
                Create a folder to organize images and notes.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Input
                aria-label="Folder name"
                autoComplete="off"
                autoFocus
                disabled={isSubmitting}
                placeholder="Folder name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {error ? (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Creating
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
