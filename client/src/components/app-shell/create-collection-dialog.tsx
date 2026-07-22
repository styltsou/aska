import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

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
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New collection</DialogTitle>
              <DialogDescription>
                Create a collection to organize your assets.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Input
                autoComplete="off"
                placeholder="Collection name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button disabled={createCollection.isPending} type="submit">
              {createCollection.isPending ? (
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
