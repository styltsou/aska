import React, { useMemo, useState } from "react";
import { FolderPlusIcon, LoaderCircleIcon } from "lucide-react";
import { useCreateFolder } from "@/api/collection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { slugFromTitle } from "@/lib/slug";

export function CreateFolderDialog({
  workspaceSlug,
  collectionPath,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  workspaceSlug: string;
  collectionPath: string;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <FolderPlusIcon />
              )}
              <span>{isSubmitting ? "Creating" : "Create"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
