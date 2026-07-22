import { useMemo, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";

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
import { authClient } from "@/lib/auth-client";
import { clearAuthStateCache, setActiveWorkspace } from "@/lib/auth-flow";
import { slugFromTitle } from "@/lib/slug";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slug = useMemo(() => slugFromTitle(workspaceName), [workspaceName]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!slug) {
      setError("Use a workspace name with at least one letter or number.");
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await authClient.organization.create({
      name: workspaceName.trim(),
      slug,
    });

    if (error) {
      setError(error.message ?? "Unable to create this workspace.");
      setIsSubmitting(false);
      return;
    }

    clearAuthStateCache();
    await setActiveWorkspace(data);
    await router.invalidate();
    void navigate({
      to: "/$workspaceSlug",
      params: { workspaceSlug: data.slug },
      replace: true,
    });
    onOpenChange(false);
    setIsSubmitting(false);
    setWorkspaceName("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setWorkspaceName("");
      setError(null);
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form className="contents" onSubmit={handleSubmit}>
          <DialogBody className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New workspace</DialogTitle>
              <DialogDescription>
                Create a shared space for your collections.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Input
                autoComplete="organization"
                placeholder="Workspace name"
                required
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
