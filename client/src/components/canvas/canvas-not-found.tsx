import { ArrowLeftIcon, FolderXIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useWorkspaceOverlayNavigation } from "@/components/app-shell/use-workspace-overlay-navigation";

type NotFoundProps = {
  workspaceSlug: string;
  collectionSlug?: string;
  collectionName?: string;
};

function MissingResourceMark() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-10 w-16 text-muted-foreground"
    >
      <FolderXIcon
        className="absolute top-0 left-1/2 size-10 -translate-x-1/2"
        strokeWidth={1.25}
      />
    </div>
  );
}

function NotFoundShell({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden"
      role="alert"
    >
      <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-3">
          <MissingResourceMark />
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {actions ? (
            <div className="flex items-center justify-center gap-2 pt-1">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CollectionNotFound({
  workspaceSlug,
  collectionName,
}: Omit<NotFoundProps, "collectionSlug">) {
  const navigateOverlay = useWorkspaceOverlayNavigation();
  return (
    <NotFoundShell
      title="Collection not found"
      description={
        collectionName
          ? `"${collectionName}" doesn't exist or was deleted.`
          : "This collection doesn't exist or was deleted."
      }
      actions={
        <Button
          size="lg"
          onClick={() =>
            void navigateOverlay(`/${workspaceSlug}`, {
              asset: undefined,
              view: undefined,
            })
          }
        >
          <ArrowLeftIcon />
          <span>Back to collections</span>
        </Button>
      }
    />
  );
}

export function FolderNotFound({
  workspaceSlug,
  collectionSlug,
  collectionName,
}: NotFoundProps) {
  const navigateOverlay = useWorkspaceOverlayNavigation();
  return (
    <NotFoundShell
      title="Folder not found"
      description={
        collectionName
          ? `This folder in "${collectionName}" doesn't exist or was deleted.`
          : "This folder doesn't exist or was deleted."
      }
      actions={
        collectionSlug ? (
          <Button
            size="lg"
            onClick={() =>
              void navigateOverlay(
                `/${workspaceSlug}/collections/${collectionSlug}`,
                { asset: undefined, view: undefined },
              )
            }
          >
            <ArrowLeftIcon />
            <span>Back to collection</span>
          </Button>
        ) : undefined
      }
    />
  );
}
