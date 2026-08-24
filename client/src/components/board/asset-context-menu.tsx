import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  useDeleteAsset,
  useDeleteCollectionNode,
  useFlattenFolder,
} from "@/api/collection";
import { fetchAssetImageBlob } from "@/api/collection/fetchers";
import type { Asset, ColorAsset, ImageAsset, NoteAsset } from "@/types/asset";
import type { LinkAsset } from "@/types/asset";
import { useRefreshLink } from "@/api/url-unfurl";
import {
  MoveToDialog,
  type MoveToDialogSource,
} from "@/components/move-to-dialog";
import { copyImageToClipboard } from "@/lib/clipboard";
import { gradientToCss } from "@/lib/color-gradient";
import { ColorEditorDialog } from "@/components/app-shell/color-editor-dialog";
import {
  useWorkspacePeek,
  type PeekColorScope,
} from "@/components/app-shell/workspace-peek";
import { useRouterState } from "@tanstack/react-router";
import { getPexelsBrowserScope, useSessionStore } from "@/store";

type ImagePrefetch = {
  controller: AbortController;
  claimedByCopy: boolean;
  result: Promise<{ blob: Blob } | { error: unknown }>;
};

async function fetchImageFromUrl(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Unable to download the original image.");
  }
  return response.blob();
}

async function copyImage(loadImageBlob: () => Promise<Blob>) {
  try {
    await copyImageToClipboard(loadImageBlob);
    toast.success("Copied image.");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Unable to copy image.",
    );
  }
}

function imageActions(asset: ImageAsset, onCopy: () => void) {
  return (
    <>
      {asset.sourceUrl ? (
        <ContextMenuItem
          onClick={() =>
            window.open(asset.sourceUrl, "_blank", "noopener,noreferrer")
          }
        >
          Open original
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem onClick={onCopy}>Copy image</ContextMenuItem>
    </>
  );
}

async function copyText(asset: NoteAsset) {
  await navigator.clipboard.writeText(asset.content);
  toast.success("Copied note text.");
}

function noteActions(
  asset: NoteAsset,
  onEditNote?: () => void,
  onPeek?: () => void,
) {
  return (
    <>
      <ContextMenuItem onClick={() => void copyText(asset)}>
        Copy text
      </ContextMenuItem>
      <ContextMenuItem disabled={!onEditNote} onClick={onEditNote}>
        Edit note
      </ContextMenuItem>
      <ContextMenuItem onClick={onPeek}>Peek note</ContextMenuItem>
    </>
  );
}

function colorActions(
  asset: ColorAsset,
  onOpen: () => void,
  onEdit: () => void,
  onPeek?: () => void,
) {
  const copiedValue = asset.gradient
    ? gradientToCss(
        asset.gradient.stops ?? [
          { color: asset.gradient.from, position: 0 },
          { color: asset.gradient.to, position: 100 },
        ],
        asset.gradient.type ?? "linear",
        asset.gradient.angle,
      )
    : asset.hex;
  const copyLabel = asset.gradient ? "Copy CSS" : "Copy hex";

  return (
    <>
      <ContextMenuItem onClick={onOpen}>Open</ContextMenuItem>
      <ContextMenuItem onClick={onEdit}>Edit color</ContextMenuItem>
      <ContextMenuItem onClick={onPeek}>Peek color</ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          void navigator.clipboard
            .writeText(copiedValue)
            .then(() =>
              toast.success(
                asset.gradient ? "Copied CSS gradient." : "Copied color.",
              ),
            )
            .catch((error: unknown) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to copy color.",
              ),
            );
        }}
      >
        {copyLabel}
      </ContextMenuItem>
    </>
  );
}

function folderActions() {
  return (
    <>
      <ContextMenuItem>Open folder</ContextMenuItem>
      <ContextMenuItem>Rename folder</ContextMenuItem>
    </>
  );
}

function linkActions(asset: LinkAsset, onRefresh: () => void) {
  const refreshAllowed =
    asset.failureCategory !== "credentials" &&
    asset.failureCategory !== "sensitive_query";
  return (
    <>
      <ContextMenuItem
        onClick={() =>
          window.open(asset.originalUrl, "_blank", "noopener,noreferrer")
        }
      >
        Open link
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          void navigator.clipboard
            .writeText(asset.originalUrl)
            .then(() => toast.success("Copied link."));
        }}
      >
        Copy link
      </ContextMenuItem>
      {refreshAllowed ? (
        <ContextMenuItem onClick={onRefresh}>Refresh preview</ContextMenuItem>
      ) : null}
    </>
  );
}

export function AssetContextMenu({
  asset,
  children,
  deleteContext,
  inboxContext,
  onOpenImage,
  onOpenColor,
  onEditNote,
}: {
  asset: Asset;
  children: (isContextMenuOpen: boolean, asset: Asset) => React.ReactNode;
  deleteContext?: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
    expectedParentFolderNodeId: string | null;
  };
  inboxContext?: {
    workspaceSlug: string;
  };
  onOpenImage?: () => void;
  onOpenColor?: () => void;
  onEditNote?: () => void;
}) {
  const { peekNote, peekColor } = useWorkspacePeek();
  const setPexelsBrowserOpen = useSessionStore(
    (state) => state.setPexelsBrowserOpen,
  );
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [colorPreview, setColorPreview] = useState<Pick<
    ColorAsset,
    "hex" | "gradient"
  > | null>(null);
  const imagePrefetchRef = useRef<ImagePrefetch | undefined>(undefined);
  const workspaceSlug =
    inboxContext?.workspaceSlug ?? deleteContext?.workspaceSlug;
  const isFavorite = asset.isFavorite ?? false;
  const displayAsset: Asset =
    asset.type === "color" && colorPreview
      ? { ...asset, ...colorPreview }
      : asset;
  const removeNode = useDeleteCollectionNode(
    deleteContext?.workspaceSlug ?? "",
    deleteContext?.collectionSlug ?? "",
    deleteContext?.folderPath,
  );
  const deleteAsset = useDeleteAsset(
    inboxContext?.workspaceSlug ?? deleteContext?.workspaceSlug ?? "",
  );
  const flattenFolder = useFlattenFolder(
    deleteContext?.workspaceSlug ?? "",
    deleteContext?.collectionSlug ?? "",
  );
  const refreshLink = useRefreshLink(workspaceSlug ?? "");
  const moveSource: MoveToDialogSource | undefined = deleteContext
    ? {
        workspaceSlug: deleteContext.workspaceSlug,
        sourceCollectionSlug: deleteContext.collectionSlug,
        sourceFolderPath: deleteContext.folderPath,
        nodeIds: [asset.id],
      }
    : inboxContext
      ? {
          workspaceSlug: inboxContext.workspaceSlug,
          nodeIds: [asset.id],
        }
      : undefined;
  const peekScope: PeekColorScope = (() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[1] !== "collections" || !segments[2]) return { type: "inbox" };
    const [collectionSlug, ...folders] = segments.slice(2);
    return {
      type: "collection",
      collectionSlug,
      folderPath: folders.join("/") || undefined,
      includeDescendants: false,
    };
  })();
  const closePexels = () => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[1] === "collections" && segments[0] && segments[2]) {
      setPexelsBrowserOpen(
        getPexelsBrowserScope(segments[0], segments[2]),
        false,
      );
    }
  };

  useEffect(() => {
    return () => {
      imagePrefetchRef.current?.controller.abort();
      imagePrefetchRef.current = undefined;
    };
  }, [asset.id, workspaceSlug]);

  function cancelImagePrefetch() {
    const prefetch = imagePrefetchRef.current;
    if (!prefetch || prefetch.claimedByCopy) return;

    prefetch.controller.abort();
    imagePrefetchRef.current = undefined;
  }

  function startImagePrefetch() {
    cancelImagePrefetch();
    if (asset.type !== "image" || asset.uploadStatus || !workspaceSlug) return;

    const controller = new AbortController();
    imagePrefetchRef.current = {
      controller,
      claimedByCopy: false,
      // Resolve errors into data so an aborted, unused prefetch never creates
      // an unhandled promise rejection.
      result: fetchAssetImageBlob(
        workspaceSlug,
        asset.id,
        controller.signal,
      ).then(
        (blob) => ({ blob }),
        (error: unknown) => ({ error }),
      ),
    };
  }

  function handleContextMenuOpenChange(open: boolean) {
    if (open) {
      startImagePrefetch();
    } else {
      cancelImagePrefetch();
    }
  }

  function handleCopyImage() {
    if (asset.type !== "image") return;

    const prefetch = imagePrefetchRef.current;
    if (prefetch) prefetch.claimedByCopy = true;

    const loadImageBlob = prefetch
      ? async () => {
          const result = await prefetch.result;
          if ("blob" in result) return result.blob;
          throw result.error;
        }
      : workspaceSlug && !asset.uploadStatus
        ? () => fetchAssetImageBlob(workspaceSlug, asset.id)
        : () =>
            fetchImageFromUrl(
              asset.localPreviewUrl ?? asset.originalUrl ?? asset.url,
            );

    void copyImage(loadImageBlob).finally(() => {
      if (imagePrefetchRef.current === prefetch) {
        imagePrefetchRef.current = undefined;
      }
    });
  }

  function handleDelete() {
    setDeleteDialogOpen(false);
    if (asset.type === "folder") {
      removeNode.mutate(asset.id, {
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Unable to delete asset.",
          );
        },
      });
    } else {
      deleteAsset.mutate(asset.id, {
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Unable to delete asset.",
          );
        },
      });
    }
  }

  function handleFlatten() {
    flattenFolder.mutate(asset.id, {
      onSuccess: (result) => {
        toast.success(
          result.directChildCount === 0
            ? "Empty folder removed."
            : `Flattened ${result.directChildCount} direct ${result.directChildCount === 1 ? "item" : "items"} to the right of this canvas.`,
        );
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Unable to flatten folder.",
        );
      },
    });
  }

  return (
    <>
      <ContextMenu onOpenChange={handleContextMenuOpenChange}>
        <ContextMenuTrigger
          render={(triggerProps, state) => (
            <div {...triggerProps}>{children(state.open, displayAsset)}</div>
          )}
        />
        <ContextMenuContent>
          {asset.type === "folder" ? (
            <>
              {folderActions()}
              <ContextMenuItem>
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </ContextMenuItem>
              <ContextMenuSeparator />
              {moveSource ? (
                <ContextMenuItem onClick={() => setMoveDialogOpen(true)}>
                  Move to...
                </ContextMenuItem>
              ) : null}
              {deleteContext ? (
                <ContextMenuItem onClick={handleFlatten}>
                  Flatten folder
                </ContextMenuItem>
              ) : null}
            </>
          ) : asset.type === "color" ? (
            <>
              {colorActions(
                asset,
                onOpenColor ?? (() => {}),
                () => setColorEditorOpen(true),
                () => {
                  closePexels();
                  peekColor(asset, peekScope);
                },
              )}
              <ContextMenuSeparator />
              <ContextMenuItem>
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </ContextMenuItem>
              {moveSource ? (
                <ContextMenuItem onClick={() => setMoveDialogOpen(true)}>
                  Move to...
                </ContextMenuItem>
              ) : null}
            </>
          ) : (
            <>
              {asset.type === "image" && onOpenImage ? (
                <ContextMenuItem onClick={onOpenImage}>Open</ContextMenuItem>
              ) : null}
              <ContextMenuItem>
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </ContextMenuItem>
              {moveSource ? (
                <ContextMenuItem onClick={() => setMoveDialogOpen(true)}>
                  Move to...
                </ContextMenuItem>
              ) : null}
              <ContextMenuSeparator />
              {asset.type === "image"
                ? imageActions(asset, handleCopyImage)
                : asset.type === "note"
                  ? noteActions(asset, onEditNote, () => {
                      closePexels();
                      peekNote(asset);
                    })
                  : linkActions(asset, () => {
                      refreshLink.mutate(asset.id, {
                        onError: (error) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Unable to refresh link.",
                          ),
                      });
                    })}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-red-600! hover:bg-red-500/20! focus:bg-red-500/20! data-highlighted:bg-red-500/20! dark:text-red-400! dark:hover:bg-red-500/30! dark:focus:bg-red-500/30! dark:data-highlighted:bg-red-500/30!"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogBody>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {asset.type === "folder" ? "Delete folder" : "Delete asset"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {asset.type === "folder"
                  ? "This deletes the folder. Assets inside it will move back to Inbox."
                  : "Are you sure you want to delete this asset? This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-primary"
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MoveToDialog
        open={moveDialogOpen && moveSource !== undefined}
        onOpenChange={setMoveDialogOpen}
        source={moveSource ?? { workspaceSlug: "", nodeIds: [] }}
      />
      {asset.type === "color" && workspaceSlug ? (
        <ColorEditorDialog
          workspaceSlug={workspaceSlug}
          collectionPath={
            deleteContext
              ? [deleteContext.collectionSlug, deleteContext.folderPath]
                  .filter(Boolean)
                  .join("/")
              : undefined
          }
          target={inboxContext ? "inbox" : "collection"}
          color={asset}
          open={colorEditorOpen}
          onOpenChange={setColorEditorOpen}
          onPreviewChange={setColorPreview}
        />
      ) : null}
    </>
  );
}
