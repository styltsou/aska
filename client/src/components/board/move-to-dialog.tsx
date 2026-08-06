import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  collectionContentsQueryOptions,
  type Breadcrumb,
  type CollectionFolderNode,
  type ContentTypeFilter,
  type FolderChildPreview,
  useCollectionContents,
  useCollections,
  useMoveCollectionNodesToFolder,
} from "@/api/collection";
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
import { ProgressiveImage } from "@/components/ui/progressive-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const FOLDER_TYPES = ["folder"] as const satisfies readonly ContentTypeFilter[];
const MAX_MOVE_BATCH_SIZE = 100;

export type MoveToDialogSource =
  | {
      kind: "collection";
      workspaceSlug: string;
      collectionSlug: string;
      folderPath?: string;
      nodeIds: string[];
    }
  | {
      kind: "inbox";
      workspaceSlug: string;
      assetIds: string[];
    };

export function MoveToDialog({
  open,
  onOpenChange,
  source,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: MoveToDialogSource;
  onMoved?: (nodeIds: readonly string[]) => void;
}) {
  return source.kind === "collection" ? (
    <CollectionMoveDialog
      open={open}
      onOpenChange={onOpenChange}
      source={source}
      onMoved={onMoved}
    />
  ) : (
    <InboxMoveDialog
      open={open}
      onOpenChange={onOpenChange}
      source={source}
      onMoved={onMoved}
    />
  );
}

function CollectionMoveDialog({
  open,
  onOpenChange,
  source,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Extract<MoveToDialogSource, { kind: "collection" }>;
  onMoved?: (nodeIds: readonly string[]) => void;
}) {
  const [destinationPath, setDestinationPath] = useState<string>();
  const [selectedCollectionSlug, setSelectedCollectionSlug] =
    useState<string>();
  const [error, setError] = useState<string>();
  const includesFolder = source.nodeIds.some((id) => id.startsWith("folder-"));
  const {
    data: collectionsData,
    isLoading: collectionsLoading,
    isError: collectionsError,
  } = useCollections(source.workspaceSlug);
  const targetCollectionSlug = includesFolder
    ? source.collectionSlug
    : (selectedCollectionSlug ?? source.collectionSlug);
  const targetCollection = collectionsData?.collections.find(
    (collection) => collection.slug === targetCollectionSlug,
  );
  const moveNodes = useMoveCollectionNodesToFolder(
    source.workspaceSlug,
    targetCollectionSlug,
  );
  const destination = useFolderDestination(
    source.workspaceSlug,
    targetCollectionSlug,
    destinationPath,
    open,
    targetCollection?.name,
  );
  const destinationFolder = destination.breadcrumbs.at(-1);
  const targetFolderNodeId = destinationFolder
    ? `folder-${destinationFolder.id}`
    : null;
  const exceedsBatchLimit = source.nodeIds.length > MAX_MOVE_BATCH_SIZE;
  const canMove =
    !exceedsBatchLimit &&
    targetCollectionSlug.length > 0 &&
    !destination.isLoading &&
    !destination.isStale &&
    !destination.isError;
  const selectedFolderIds = useMemo(
    () =>
      targetCollectionSlug === source.collectionSlug
        ? new Set(source.nodeIds.filter((id) => id.startsWith("folder-")))
        : EMPTY_IDS,
    [source.collectionSlug, source.nodeIds, targetCollectionSlug],
  );

  async function handleMove() {
    if (!canMove) return;
    setError(undefined);

    try {
      await moveNodes.mutateAsync({
        nodeIds: source.nodeIds,
        folderPath: source.folderPath,
        targetFolderNodeId,
        sourceCollectionSlug: source.collectionSlug,
      });
      onMoved?.(source.nodeIds);
      toast.success(moveSuccessMessage(source.nodeIds.length));
      onOpenChange(false);
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to move the selected items.",
      );
    }
  }

  const disabledReason = exceedsBatchLimit
    ? `Move up to ${MAX_MOVE_BATCH_SIZE} items at a time.`
    : collectionsError
      ? "Unable to load collections. Close this dialog and try again."
      : undefined;

  const collectionPicker = includesFolder ? undefined : (
    <Select
      value={targetCollectionSlug}
      disabled={collectionsLoading || moveNodes.isPending}
      onValueChange={(nextCollectionSlug) => {
        setSelectedCollectionSlug(nextCollectionSlug ?? undefined);
        setDestinationPath(undefined);
        setError(undefined);
      }}
    >
      <SelectTrigger className="w-full" aria-label="Destination collection">
        <SelectValue placeholder="Select collection" />
      </SelectTrigger>
      <SelectContent>
        {(collectionsData?.collections ?? []).map((collection) => (
          <SelectItem key={collection.id} value={collection.slug}>
            {collection.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <DestinationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!moveNodes.isPending) onOpenChange(nextOpen);
      }}
      title="Move to..."
      description={
        includesFolder
          ? "Browse to a folder or use this collection's root as the destination."
          : "Choose a collection, then browse to a folder or use its root."
      }
      controls={collectionPicker}
      destination={destination}
      destinationPath={destinationPath}
      disabledFolderIds={selectedFolderIds}
      onDestinationPathChange={setDestinationPath}
      canMove={canMove}
      disabledReason={disabledReason}
      count={source.nodeIds.length}
      isPending={moveNodes.isPending}
      error={error}
      onMove={() => void handleMove()}
    />
  );
}

function InboxMoveDialog({
  open,
  onOpenChange,
  source,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Extract<MoveToDialogSource, { kind: "inbox" }>;
  onMoved?: (nodeIds: readonly string[]) => void;
}) {
  const {
    data: collectionsData,
    isLoading: collectionsLoading,
    isError: collectionsError,
  } = useCollections(source.workspaceSlug);
  const collections = collectionsData?.collections ?? [];
  const [selectedCollectionSlug, setSelectedCollectionSlug] =
    useState<string>();
  const collectionSlug = selectedCollectionSlug ?? collections[0]?.slug ?? "";
  const selectedCollection = collections.find(
    (collection) => collection.slug === collectionSlug,
  );
  const [destinationPath, setDestinationPath] = useState<string>();
  const [error, setError] = useState<string>();
  const moveAssets = useMoveCollectionNodesToFolder(
    source.workspaceSlug,
    collectionSlug,
  );
  const destination = useFolderDestination(
    source.workspaceSlug,
    collectionSlug,
    destinationPath,
    open && collectionSlug.length > 0,
    selectedCollection?.name,
  );
  const exceedsBatchLimit = source.assetIds.length > MAX_MOVE_BATCH_SIZE;
  const canMove =
    collectionSlug.length > 0 &&
    source.assetIds.length > 0 &&
    !exceedsBatchLimit &&
    !destination.isLoading &&
    !destination.isStale &&
    !destination.isError;

  async function handleMove() {
    if (!canMove) return;
    setError(undefined);

    try {
      const result = await moveAssets.mutateAsync({
        nodeIds: source.assetIds,
        targetFolderNodeId: destination.breadcrumbs.at(-1)
          ? `folder-${destination.breadcrumbs.at(-1)!.id}`
          : null,
      });
      const movedNodeIds = result.moves
        .filter((move) => move.moved)
        .map((move) => move.nodeId);
      onMoved?.(movedNodeIds);
      toast.success(moveSuccessMessage(movedNodeIds.length));
      onOpenChange(false);
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to move the selected items.",
      );
    }
  }

  const collectionPicker = (
    <Select
      value={collectionSlug}
      disabled={collectionsLoading || moveAssets.isPending}
      onValueChange={(nextCollectionSlug) => {
        setSelectedCollectionSlug(nextCollectionSlug ?? undefined);
        setDestinationPath(undefined);
        setError(undefined);
      }}
    >
      <SelectTrigger className="w-full" aria-label="Destination collection">
        <SelectValue
          placeholder={
            collectionsLoading ? "Loading collections..." : "Select collection"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {collections.map((collection) => (
          <SelectItem key={collection.id} value={collection.slug}>
            {collection.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <DestinationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!moveAssets.isPending) onOpenChange(nextOpen);
      }}
      title="Move to..."
      description="Choose a collection, then open the destination folder."
      controls={collectionPicker}
      destination={destination}
      destinationPath={destinationPath}
      disabledFolderIds={EMPTY_IDS}
      onDestinationPathChange={setDestinationPath}
      canMove={canMove}
      disabledReason={
        exceedsBatchLimit
          ? `Move up to ${MAX_MOVE_BATCH_SIZE} items at a time.`
          : collectionsError
            ? "Unable to load collections. Close this dialog and try again."
            : collections.length === 0 && !collectionsLoading
              ? "Create a collection before moving items from Inbox."
              : undefined
      }
      count={source.assetIds.length}
      isPending={moveAssets.isPending}
      error={error}
      onMove={() => void handleMove()}
    />
  );
}

const EMPTY_IDS = new Set<string>();

type FolderDestination = {
  collectionName: string;
  breadcrumbs: Breadcrumb[];
  folders: CollectionFolderNode[];
  isLoading: boolean;
  isError: boolean;
  isStale: boolean;
  prefetch: (folderPath: string) => void;
};

function useFolderDestination(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath: string | undefined,
  enabled: boolean,
  fallbackCollectionName?: string,
): FolderDestination {
  const queryClient = useQueryClient();
  const query = useCollectionContents(
    workspaceSlug,
    collectionSlug,
    folderPath,
    {
      enabled,
      types: FOLDER_TYPES,
    },
  );
  const resolvedPath = query.data?.breadcrumbs
    .map((breadcrumb) => breadcrumb.slug)
    .join("/");
  const requestedPath = folderPath ?? "";
  const isStale =
    query.isPlaceholderData &&
    (resolvedPath !== requestedPath ||
      query.data?.collection.slug !== collectionSlug);
  const data = isStale ? undefined : query.data;

  return {
    collectionName:
      data?.collection.name ?? fallbackCollectionName ?? "Collection",
    breadcrumbs: data?.breadcrumbs ?? [],
    folders:
      data?.nodes.flatMap((node) => (node.type === "folder" ? [node] : [])) ??
      [],
    isLoading: enabled && (query.isLoading || isStale),
    isError: query.isError,
    isStale,
    prefetch: (nextFolderPath) => {
      void queryClient.prefetchQuery(
        collectionContentsQueryOptions(
          workspaceSlug,
          collectionSlug,
          nextFolderPath,
          FOLDER_TYPES,
        ),
      );
    },
  };
}

function DestinationDialog({
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
  onMove: () => void;
}) {
  const currentName =
    destination.breadcrumbs.at(-1)?.name ?? destination.collectionName;
  const parentPath = pathThroughBreadcrumbs(
    destination.breadcrumbs,
    destination.breadcrumbs.length - 2,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogBody className="flex flex-col gap-4 pb-3">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {controls}
          <div className="overflow-hidden rounded-lg border bg-muted/20">
            <div className="flex h-10 items-center gap-1 border-b bg-background/70 px-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Go to parent folder"
                disabled={!destinationPath || destination.isStale || isPending}
                onClick={() => onDestinationPathChange(parentPath)}
              >
                <ArrowLeftIcon />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm whitespace-nowrap">
                <button
                  type="button"
                  className="rounded px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                  disabled={destination.isStale || isPending}
                  onClick={() => onDestinationPathChange(undefined)}
                >
                  {destination.collectionName}
                </button>
                {destination.breadcrumbs.map((breadcrumb, index) => (
                  <span
                    key={breadcrumb.id}
                    className="flex min-w-0 items-center gap-0.5"
                  >
                    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                    <button
                      type="button"
                      className={cn(
                        "max-w-36 truncate rounded px-1.5 py-1 transition-colors hover:bg-muted",
                        index === destination.breadcrumbs.length - 1
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      disabled={destination.isStale || isPending}
                      onClick={() =>
                        onDestinationPathChange(
                          pathThroughBreadcrumbs(
                            destination.breadcrumbs,
                            index,
                          ),
                        )
                      }
                    >
                      {breadcrumb.name}
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="h-72 overflow-y-auto p-1.5">
              {destination.isLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Loading folders
                </div>
              ) : destination.isError ? (
                <p className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
                  Unable to load this folder. Go back and try again.
                </p>
              ) : destination.folders.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <FolderIcon className="size-8 opacity-25" />
                  <p className="text-sm">No folders here</p>
                </div>
              ) : (
                destination.folders.map((folder) => {
                  const folderPath = joinPath(destinationPath, folder.slug);
                  const isDisabled = disabledFolderIds.has(folder.id);
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
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
                      onClick={() => onDestinationPathChange(folderPath)}
                    >
                      <FolderPreviewRow previews={folder.previews} />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {folder.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {folder.count}
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter className="items-center">
          <div className="min-w-0 text-xs text-muted-foreground">
            {disabledReason ?? (
              <span className="block truncate">
                Destination:{" "}
                <strong className="font-medium">{currentName}</strong>
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
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
                `Move ${count === 1 ? "item" : `${count} items`} here`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderPreviewRow({ previews }: { previews: FolderChildPreview[] }) {
  const visible = previews.slice(0, 3);

  if (visible.length === 0) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded bg-sidebar-foreground/5">
        <FolderIcon className="size-4 text-sidebar-foreground/35" />
      </div>
    );
  }

  return (
    <div className="flex w-20 shrink-0 gap-0.5">
      {visible.map((preview) =>
        preview.type === "image" && preview.url ? (
          <div
            key={preview.assetId}
            className="size-8 overflow-hidden rounded-[3px] bg-muted"
          >
            <ProgressiveImage
              src={preview.url}
              blurDataURL={preview.blurDataURL}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div
            key={preview.assetId}
            className="size-8 overflow-hidden rounded-[3px] border p-1 text-[5px] leading-tight text-foreground/45"
            style={
              preview.color ? { backgroundColor: preview.color } : undefined
            }
          >
            {preview.snippet?.slice(0, 42)}
          </div>
        ),
      )}
    </div>
  );
}

function pathThroughBreadcrumbs(
  breadcrumbs: readonly Breadcrumb[],
  endIndex: number,
): string | undefined {
  if (endIndex < 0) return undefined;
  return breadcrumbs
    .slice(0, endIndex + 1)
    .map((breadcrumb) => breadcrumb.slug)
    .join("/");
}

function joinPath(parentPath: string | undefined, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : slug;
}

function moveSuccessMessage(count: number): string {
  return count === 1 ? "Item moved." : `${count} items moved.`;
}
