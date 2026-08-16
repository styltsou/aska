import { createFileRoute } from "@tanstack/react-router";
import { CollectionCard } from "@/components/collection-card";
import { CollectionGridSkeleton } from "@/components/collection-grid-skeleton";
import { CreateCollectionDialog } from "@/components/app-shell/create-collection-dialog";
import { useCollections } from "@/api/collection";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceLoadError } from "@/components/resource-load-error";

export const Route = createFileRoute("/$workspaceSlug/")({
  head: () => ({
    meta: [{ title: "Collections | Aska" }],
  }),
  component: WorkspacePage,
  pendingComponent: CollectionGridSkeleton,
});

function WorkspacePage() {
  const { workspaceSlug } = Route.useParams();
  const { data, isLoading, isError, isFetching, refetch } =
    useCollections(workspaceSlug);

  if (isLoading) {
    return <CollectionGridSkeleton />;
  }

  if (isError || !data) {
    return (
      <ResourceLoadError
        isRetrying={isFetching}
        resourceName="collections"
        onRetry={() => void refetch()}
      />
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
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @min-[25rem]:grid-cols-2 @min-[38rem]:grid-cols-3 @min-[50rem]:grid-cols-4">
        {collections.map((collection) => (
          <CollectionCard
            key={collection.slug}
            collection={collection}
            workspaceSlug={workspaceSlug}
          />
        ))}
      </div>
    </div>
  );
}
