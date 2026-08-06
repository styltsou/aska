import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderComposer } from "./folder-composer";
import { FolderPreviewRow } from "./folder-preview-row";
import type { Crumb, FolderDestination } from "../lib/types";
import { crumbPathThrough, joinPath } from "../lib/utils";

export function DestinationDialog({
  open,
  onOpenChange,
  title,
  description,
  controls,
  destination,
  destinationPath,
  disabledFolderIds,
  onDestinationPathChange,
  canMove,
  disabledReason,
  count,
  isPending,
  error,
  canCreateFolder,
  onCreateFolder,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  controls?: React.ReactNode;
  destination: FolderDestination;
  destinationPath?: string;
  disabledFolderIds: ReadonlySet<string>;
  onDestinationPathChange: (path: string | undefined) => void;
  canMove: boolean;
  disabledReason?: string;
  count: number;
  isPending: boolean;
  error?: string;
  canCreateFolder?: boolean;
  onCreateFolder?: (name: string) => Promise<string>;
  onMove: () => void;
}) {
  const [optimisticCrumbs, setOptimisticCrumbs] = useState<Crumb[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState<string>();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const suppressComposerFocusRef = useRef(false);
  const serverCrumbs: Crumb[] = destination.breadcrumbs.map((breadcrumb) => ({
    id: breadcrumb.id,
    name: breadcrumb.name,
    slug: breadcrumb.slug,
  }));
  const displayedCrumbs =
    optimisticCrumbs.length > 0 ? optimisticCrumbs : serverCrumbs;

  useEffect(() => {
    const serverPath = serverCrumbs.map((crumb) => crumb.slug).join("/");
    const optimisticPath = optimisticCrumbs
      .map((crumb) => crumb.slug)
      .join("/");
    if (
      optimisticCrumbs.length > 0 &&
      serverCrumbs.length > 0 &&
      serverPath === optimisticPath
    ) {
      setOptimisticCrumbs([]);
    }
  }, [optimisticCrumbs, serverCrumbs]);

  const segments = useMemo(() => {
    const crumbs: {
      id: string | number;
      label: string;
      path: string | undefined;
    }[] = [
      {
        id: "collection",
        label: destination.collectionName,
        path: undefined,
      },
      ...displayedCrumbs.map((crumb, index) => ({
        id: crumb.id,
        label: crumb.name,
        path: crumbPathThrough(displayedCrumbs, index),
      })),
    ];
    return crumbs;
  }, [destination.collectionName, displayedCrumbs]);

  const navigateTo = (path: string | undefined, crumbs: Crumb[]) => {
    onDestinationPathChange(path);
    setOptimisticCrumbs(crumbs);
  };

  const canCreate = Boolean(onCreateFolder && canCreateFolder);

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name || !canCreate) return;
    setNewFolderError(undefined);
    setCreatingFolder(true);
    try {
      const slug = await onCreateFolder!(name);
      suppressComposerFocusRef.current = true;
      setComposerOpen(false);
      setNewFolderName("");
      navigateTo(joinPath(destinationPath, slug), [
        ...displayedCrumbs,
        { id: `folder-${slug}`, name, slug },
      ]);
    } catch (err) {
      setNewFolderError(
        err instanceof Error ? err.message : "Unable to create folder.",
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogBody className="flex flex-col gap-4 pb-3">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {controls}
          <div className="overflow-hidden rounded-lg border bg-muted/20">
            <div className="flex h-10 items-center gap-1 border-b bg-background/70 px-2">
              <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm whitespace-nowrap">
                {segments.map((segment, index) => {
                  const isCurrent = index === segments.length - 1;
                  return (
                    <Fragment key={segment.id}>
                      {index > 0 && (
                        <span className="relative flex size-3.5 shrink-0 items-center justify-center before:absolute before:h-3 before:w-px before:[transform:rotate(20deg)] before:bg-current before:text-muted-foreground/60" />
                      )}
                      {isCurrent ? (
                        segment.id === "collection" && destination.isLoading ? (
                          <span className="px-1.5 py-1">
                            <Skeleton className="h-4 w-24" />
                          </span>
                        ) : (
                          <span className="max-w-36 truncate px-1.5 py-1 font-medium text-foreground">
                            {segment.label}
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          className="max-w-36 truncate px-1.5 py-1 text-muted-foreground transition-colors duration-100 hover:text-foreground disabled:pointer-events-none"
                          disabled={destination.isStale || isPending}
                          onClick={() =>
                            navigateTo(
                              segment.path,
                              index === 0
                                ? []
                                : displayedCrumbs.slice(0, index),
                            )
                          }
                        >
                          {segment.label}
                        </button>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
            <div className="h-72 overflow-y-auto p-1.5">
              {destination.isLoading ? (
                <div className="p-1.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2"
                    >
                      <div className="flex shrink-0 gap-0.5">
                        <Skeleton className="size-8 rounded-[3px]" />
                        <Skeleton className="size-8 rounded-[3px]" />
                        <Skeleton className="size-8 rounded-[3px]" />
                      </div>
                      <div className="flex-1">
                        <Skeleton className="h-4 w-26" />
                      </div>
                      <Skeleton className="h-4 w-18 shrink-0" />
                      <Skeleton className="size-5 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : destination.isError ? (
                <p className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
                  Unable to load this folder. Go back and try again.
                </p>
              ) : (
                <>
                  {destination.folders.map((folder) => {
                    const folderPath = joinPath(destinationPath, folder.slug);
                    const isDisabled = disabledFolderIds.has(folder.id);
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-100 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={isDisabled || isPending}
                        title={
                          isDisabled
                            ? "A folder cannot be moved into itself."
                            : undefined
                        }
                        onPointerEnter={() => {
                          if (!isDisabled) destination.prefetch(folderPath);
                        }}
                        onFocus={() => {
                          if (!isDisabled) destination.prefetch(folderPath);
                        }}
                        onClick={() =>
                          navigateTo(folderPath, [
                            ...displayedCrumbs,
                            {
                              id: folder.id,
                              name: folder.name,
                              slug: folder.slug,
                            },
                          ])
                        }
                      >
                        <FolderPreviewRow previews={folder.previews} />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {folder.name}
                        </span>
                        {folder.folderCount > 0 ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {folder.folderCount === 1
                              ? "1 folder"
                              : `${folder.folderCount} folders`}
                          </span>
                        ) : null}
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
                      </button>
                    );
                  })}
                  <FolderComposer
                    open={composerOpen}
                    onOpenChange={setComposerOpen}
                    name={newFolderName}
                    onNameChange={setNewFolderName}
                    pending={creatingFolder}
                    error={newFolderError}
                    canCreate={canCreate}
                    busy={isPending || creatingFolder}
                    onCreate={() => void handleCreateFolder()}
                    suppressFocusRef={suppressComposerFocusRef}
                  />
                </>
              )}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter className="items-center">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {disabledReason ? (
            <div className="max-w-40 min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {disabledReason}
            </div>
          ) : null}
          <Button
            type="button"
            disabled={!canMove || isPending}
            onClick={onMove}
          >
            {isPending ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" />
                Moving
              </>
            ) : (
              `Move ${count === 1 ? "item" : `${count} items`}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
