import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowUpIcon, FolderIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type NotFoundProps = {
  workspaceSlug: string;
  collectionSlug?: string;
  collectionName?: string;
};

function NotFoundShell({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden"
      role="alert"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-3">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            {icon}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium">{title}</h2>
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
  const navigate = useNavigate();
  return (
    <NotFoundShell
      icon={<FolderIcon />}
      title="Collection not found"
      description={
        collectionName
          ? `"${collectionName}" doesn't exist or was deleted.`
          : "This collection doesn't exist or was deleted."
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void navigate({ to: "/$workspaceSlug", params: { workspaceSlug } })
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
  const navigate = useNavigate();
  return (
    <NotFoundShell
      icon={<FolderIcon />}
      title="Folder not found"
      description={
        collectionName
          ? `This folder in "${collectionName}" doesn't exist or was deleted.`
          : "This folder doesn't exist or was deleted."
      }
      actions={
        collectionSlug ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void navigate({
                to: "/$workspaceSlug/collections/$",
                params: { workspaceSlug, _splat: collectionSlug },
                search: { note: undefined, image: undefined },
              })
            }
          >
            <ArrowUpIcon />
            <span>Back to collection</span>
          </Button>
        ) : undefined
      }
    />
  );
}
