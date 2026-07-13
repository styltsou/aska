import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateCollection } from "@/api/collection";

export function CreateCollectionDialog({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactElement;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createCollection = useCreateCollection(workspaceSlug);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    createCollection.mutate(
      { name },
      {
        onSuccess: (data) => {
          void navigate({
            to: "/$workspaceSlug/collections/$",
            params: { workspaceSlug, _splat: data.collection.slug },
            search: { note: undefined, image: undefined },
            replace: true,
          });
          handleOpenChange(false);
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Create a collection to organize your assets.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="collection-name">
              Collection name
            </label>
            <Input
              autoComplete="off"
              id="collection-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={createCollection.isPending}
            >
              Cancel
            </Button>
            <Button disabled={createCollection.isPending} type="submit">
              {createCollection.isPending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <PlusIcon />
              )}
              <span>{createCollection.isPending ? "Creating" : "Create"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
