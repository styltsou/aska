import { createFileRoute } from "@tanstack/react-router";
import { CollectionCard } from "@/components/collection-card";
import { CollectionGridSkeleton } from "@/components/collection-grid-skeleton";
import { CreateCollectionDialog } from "@/components/app-shell/create-collection-dialog";
import { useCollections } from "@/api/collection";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/$workspaceSlug/")({
  component: WorkspacePage,
  pendingComponent: CollectionGridSkeleton,
});

function WorkspacePage() {
  const { workspaceSlug } = Route.useParams();
  const { data, isLoading, isError } = useCollections(workspaceSlug);

  if (isLoading) {
    return <CollectionGridSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Failed to load collections
      </div>
    );
  }

  const collections = data.collections;

  if (collections.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">
          This workspace doesn't have any collections yet
        </p>
        <CreateCollectionDialog workspaceSlug={workspaceSlug}>
          <Button>
            <PlusIcon />
            <span>Create collection</span>
          </Button>
        </CreateCollectionDialog>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 max-md:grid-cols-3 max-sm:grid-cols-2">
      {collections.map((collection) => (
        <CollectionCard
          key={collection.slug}
          collection={collection}
          workspaceSlug={workspaceSlug}
        />
      ))}
    </div>
  );
}
