import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";

import { useRenameCollection } from "@/api/collection";
import { getUserFacingApiErrorMessage } from "@/lib/api";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function RenameCollectionDialog({
  open,
  onOpenChange,
  collection,
  workspaceSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: { name: string; slug: string };
  workspaceSlug: string;
}) {
  const [name, setName] = useState(collection.name);
  const [error, setError] = useState<string | null>(null);
  const renameCollection = useRenameCollection(workspaceSlug);

  useEffect(() => {
    if (open) {
      setName(collection.name);
      setError(null);
    }
  }, [open, collection.name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    if (nextName === collection.name) {
      onOpenChange(false);
      return;
    }

    setError(null);
    try {
      await renameCollection.mutateAsync({
        slug: collection.slug,
        name: nextName,
      });
      onOpenChange(false);
    } catch (cause) {
      setError(
        getUserFacingApiErrorMessage(cause, "Unable to rename collection."),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Rename collection</DialogTitle>
              <DialogDescription>
                Change the name shown in this workspace.
              </DialogDescription>
            </DialogHeader>
            <Input
              aria-label="Collection name"
              autoComplete="off"
              autoFocus
              maxLength={255}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={renameCollection.isPending || !name.trim()}
              type="submit"
            >
              {renameCollection.isPending ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
