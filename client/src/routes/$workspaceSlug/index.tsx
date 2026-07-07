import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { CollectionCard } from "@/components/collection-card";
import { CollectionGridSkeleton } from "@/components/collection-grid-skeleton";
import { collections } from "@/data/collections";
import { shouldShowSkeletonPreview } from "@/lib/dev-skeleton";

export const Route = createFileRoute("/$workspaceSlug/")({
  component: WorkspacePage,
  pendingComponent: CollectionGridSkeleton,
});

function WorkspacePage() {
  const { workspaceSlug } = Route.useParams();
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });

  if (shouldShowSkeletonPreview(search)) {
    return <CollectionGridSkeleton />;
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
