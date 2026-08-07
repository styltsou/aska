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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FolderComposer } from "./folder-composer";
import { FolderPreviewRow } from "./folder-preview-row";
import type { Crumb, FolderDestination } from "../lib/types";
import { crumbPathThrough, joinPath } from "../lib/utils";

type CrumbSegment = {
  id: string | number;
  label: string;
  path: string | undefined;
  crumbIndex: number;
  hidden?: CrumbSegment[];
};

const MAX_BREADCRUMB_SEGMENTS = 5;
const MAX_BREADCRUMB_TAIL = 3;

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
  refocusKey,
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
  refocusKey?: string;
}) {
  const [optimisticCrumbs, setOptimisticCrumbs] = useState<Crumb[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState<string>();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const suppressComposerFocusRef = useRef(false);
  const submitRef = useRef<HTMLButtonElement>(null);
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

  const segments = useMemo<CrumbSegment[]>(() => {
    const crumbs: CrumbSegment[] = [
      {
        id: "collection",
        label: destination.collectionName,
        path: undefined,
        crumbIndex: -1,
      },
      ...displayedCrumbs.map((crumb, index) => ({
        id: crumb.id,
        label: crumb.name,
        path: crumbPathThrough(displayedCrumbs, index),
        crumbIndex: index,
      })),
    ];
    // Keep the collection and the last few segments visible and fold the
    // middle into an ellipsis once the path gets long.
    if (crumbs.length <= MAX_BREADCRUMB_SEGMENTS) {
      return crumbs;
    }
    const head = crumbs.slice(0, 1);
    const tail = crumbs.slice(-MAX_BREADCRUMB_TAIL);
    const hidden = crumbs.slice(1, -MAX_BREADCRUMB_TAIL);
    return [
      ...head,
      {
        id: "ellipsis",
        label: "…",
        path: undefined,
        crumbIndex: -2,
        hidden,
      },
      ...tail,
    ];
  }, [destination.collectionName, displayedCrumbs]);

  const navigateTo = (path: string | undefined, crumbs: Crumb[]) => {
    onDestinationPathChange(path);
    setOptimisticCrumbs(crumbs);
  };

  const canCreate = Boolean(onCreateFolder && canCreateFolder);

  // Focus lands on the primary action whenever the destination changes, so
  // pressing Enter always confirms the currently rendered destination. Focused
  // buttons already activate on Enter (Move submits, a folder row navigates),
  // so this also prevents Enter from re-opening a popover on the trigger.
  useEffect(() => {
    if (open) {
      submitRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refocusKey, destinationPath]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    // Let inputs and focused buttons use their own Enter behavior (create a
    // folder, navigate a folder row, open the picker) instead of submitting.
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLButtonElement ||
      target.closest("[data-slot='dropdown-menu-content']")
    ) {
      return;
    }
    if (!canMove || isPending) return;
    event.preventDefault();
    onMove();
  }

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
      <DialogContent className="max-w-2xl" onKeyDown={handleKeyDown}>
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
                  const isCurrent =
                    segment.crumbIndex === displayedCrumbs.length - 1;
                  return (
                    <Fragment key={segment.id}>
                      {index > 0 && (
                        <span className="relative flex size-3.5 shrink-0 items-center justify-center before:absolute before:h-3 before:w-px before:[transform:rotate(20deg)] before:bg-current before:text-muted-foreground/60" />
                      )}
                      {segment.id === "ellipsis" ? (
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger
                              render={(tooltipProps) => (
                                <DropdownMenuTrigger
                                  render={(triggerProps) => (
                                    <button
                                      {...tooltipProps}
                                      {...triggerProps}
                                      type="button"
                                      aria-label="Show intermediate folders"
                                      className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground transition-colors duration-75 outline-none select-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none data-popup-open:bg-accent data-popup-open:text-accent-foreground"
                                      disabled={
                                        destination.isStale || isPending
                                      }
                                    >
                                      …
                                    </button>
                                  )}
                                />
                              )}
                            />
                            <TooltipContent side="bottom">
                              More folders
                            </TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="start">
                            {segment.hidden?.map((hidden) => (
                              <DropdownMenuItem
                                key={hidden.id}
                                className="cursor-pointer"
                                onClick={() =>
                                  navigateTo(
                                    hidden.path,
                                    hidden.crumbIndex < 0
                                      ? []
                                      : displayedCrumbs.slice(
                                          0,
                                          hidden.crumbIndex,
                                        ),
                                  )
                                }
                              >
                                {hidden.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : isCurrent ? (
                        segment.crumbIndex === -1 && destination.isLoading ? (
                          <span className="px-1.5 py-1">
                            <Skeleton className="h-4 w-24" />
                          </span>
                        ) : (
                          <span className="max-w-36 truncate rounded-md px-2 py-1 text-foreground">
                            {segment.label}
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          className="max-w-36 truncate rounded-md px-2 py-1 text-muted-foreground transition-colors duration-75 hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none"
                          disabled={destination.isStale || isPending}
                          onClick={() =>
                            navigateTo(
                              segment.path,
                              segment.crumbIndex < 0
                                ? []
                                : displayedCrumbs.slice(0, segment.crumbIndex),
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
                        className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-75 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
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
            ref={submitRef}
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
