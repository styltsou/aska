import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { cn } from "@/lib/utils";

import { NoteMarkdown } from "./board/cards/note-asset-card";
import { useDeleteCollection } from "@/api/collection";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import type { FolderChildPreview } from "@/api/collection/types";

const PREVIEW_TRANSITION = "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)";

const PREVIEW_POSITION: CSSProperties = {
  inset: 0,
  margin: "auto",
  width: "54%",
  transformOrigin: "bottom center",
};

interface CollectionCardItem {
  id: number;
  slug: string;
  name: string;
  assetCount: number;
  previews: FolderChildPreview[];
}

interface CollectionCardProps {
  collection: CollectionCardItem;
  workspaceSlug: string;
}

export function CollectionCard({
  collection,
  workspaceSlug,
}: CollectionCardProps) {
  const [hovered, setHovered] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteCollection = useDeleteCollection(workspaceSlug);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={(triggerProps) => (
            <div className="relative aspect-square">
              <Link
                {...triggerProps}
                to="/$workspaceSlug/collections/$"
                search={{ note: undefined, image: undefined }}
                params={{ workspaceSlug, _splat: collection.slug }}
                className="relative grid aspect-square cursor-pointer grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-sidebar transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-foreground/20 data-popup-open:border-sidebar-foreground/20"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-sidebar">
                  {collection.previews.length === 0 ? (
                    <div className="grid grid-cols-2 gap-1 opacity-20">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="size-5 rounded border border-sidebar-foreground/40"
                        />
                      ))}
                    </div>
                  ) : collection.previews.length === 1 ? (
                    (() => {
                      const preview = collection.previews[0];
                      if (preview.type === "image" && preview.url) {
                        return (
                          <div
                            style={{
                              ...PREVIEW_POSITION,
                              zIndex: 0,
                              transform: `rotate(-3deg) scale(${hovered ? 1.02 : 1})`,
                              transition: PREVIEW_TRANSITION,
                            }}
                            className="absolute aspect-square"
                          >
                            <ProgressiveImage
                              src={preview.url}
                              blurDataURL={preview.blurDataURL}
                              alt=""
                              className="size-full rounded-xl object-cover shadow-md ring-1 ring-sidebar-foreground/5"
                            />
                          </div>
                        );
                      }
                      return (
                        <div
                          className={cn(
                            "ring-sidebar-foreground/5 absolute flex aspect-square flex-col items-start justify-start gap-0.5 overflow-hidden rounded-xl px-3 pt-3 pb-0 shadow-md ring-1",
                            !preview.color && "bg-card",
                          )}
                          style={{
                            ...PREVIEW_POSITION,
                            zIndex: 0,
                            transform: `rotate(-3deg) scale(${hovered ? 1.02 : 1})`,
                            transition: PREVIEW_TRANSITION,
                            ...(preview.color
                              ? { backgroundColor: preview.color }
                              : {}),
                          }}
                        >
                          {preview.snippet ? (
                            <NoteMarkdown
                              content={preview.snippet}
                              className="text-xs leading-[1.2] [&_a]:!text-xs [&_blockquote]:!text-xs [&_code]:!text-xs [&_h1]:!my-0 [&_h1]:!text-xs [&_h2]:!my-0 [&_h2]:!text-xs [&_h3]:!my-0 [&_h3]:!text-xs [&_h4]:!my-0 [&_h4]:!text-xs [&_h5]:!my-0 [&_h5]:!text-xs [&_h6]:!my-0 [&_h6]:!text-xs [&_li]:!my-0 [&_li]:!text-xs [&_ol]:!my-0 [&_p]:!my-0 [&_p]:!text-xs [&_pre]:!text-xs [&_ul]:!my-0"
                            />
                          ) : (
                            <span className="text-[10px] font-medium text-sidebar-foreground/20">
                              Note
                            </span>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    collection.previews.map((preview, i) => {
                      const count = collection.previews.length;
                      const deg = (i - (count - 1) / 2) * 3;
                      const hovDeg = (i - (count - 1) / 2) * 9;
                      const x = (i - (count - 1) / 2) * 4;
                      const y = i * 5;
                      const hoverX = (i - (count - 1) / 2) * 12;
                      const hoverY = Math.abs(i - (count - 1) / 2) * 3 - 3;
                      const z = count - 1 - i;

                      if (preview.type === "image" && preview.url) {
                        return (
                          <div
                            key={preview.assetId}
                            style={{
                              ...PREVIEW_POSITION,
                              zIndex: z,
                              transform: `translate(${hovered ? hoverX : x}px, ${hovered ? hoverY : y}px) rotate(${hovered ? hovDeg : deg}deg) scale(${hovered ? 1.02 : 1})`,
                              transition: PREVIEW_TRANSITION,
                              transitionDelay: hovered
                                ? `${(count - 1 - z) * 10}ms`
                                : `${z * 10}ms`,
                            }}
                            className="absolute aspect-square"
                          >
                            <ProgressiveImage
                              src={preview.url}
                              blurDataURL={preview.blurDataURL}
                              alt=""
                              className="size-full rounded-xl object-cover shadow-md ring-1 ring-sidebar-foreground/5"
                            />
                          </div>
                        );
                      }
                      return (
                        <div
                          key={preview.assetId}
                          className={cn(
                            "ring-sidebar-foreground/5 absolute flex aspect-square flex-col items-start justify-start gap-0.5 overflow-hidden rounded-xl px-3 pt-3 pb-0 shadow-md ring-1",
                            !preview.color && "bg-card",
                          )}
                          style={{
                            ...PREVIEW_POSITION,
                            zIndex: z,
                            transform: `translate(${hovered ? hoverX : x}px, ${hovered ? hoverY : y}px) rotate(${hovered ? hovDeg : deg}deg) scale(${hovered ? 1.02 : 1})`,
                            transition: PREVIEW_TRANSITION,
                            transitionDelay: hovered
                              ? `${(count - 1 - z) * 10}ms`
                              : `${z * 10}ms`,
                            ...(preview.color
                              ? { backgroundColor: preview.color }
                              : {}),
                          }}
                        >
                          {preview.snippet ? (
                            <NoteMarkdown
                              content={preview.snippet}
                              className="text-xs leading-[1.2] [&_a]:!text-xs [&_blockquote]:!text-xs [&_code]:!text-xs [&_h1]:!my-0 [&_h1]:!text-xs [&_h2]:!my-0 [&_h2]:!text-xs [&_h3]:!my-0 [&_h3]:!text-xs [&_h4]:!my-0 [&_h4]:!text-xs [&_h5]:!my-0 [&_h5]:!text-xs [&_h6]:!my-0 [&_h6]:!text-xs [&_li]:!my-0 [&_li]:!text-xs [&_ol]:!my-0 [&_p]:!my-0 [&_p]:!text-xs [&_pre]:!text-xs [&_ul]:!my-0"
                            />
                          ) : (
                            <span className="text-[10px] font-medium text-sidebar-foreground/20">
                              Note
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="flex items-center gap-2 bg-sidebar px-3 py-2.5">
                  <span className="truncate text-sm font-medium">
                    {collection.name}
                  </span>
                  <span className="ml-auto text-xs text-sidebar-foreground/40">
                    {collection.assetCount}
                  </span>
                </div>
              </Link>
            </div>
          )}
        />
        <ContextMenuContent>
          <ContextMenuItem>Rename</ContextMenuItem>
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
              <AlertDialogTitle>Delete collection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <strong>{collection.name}</strong>? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-primary"
              disabled={deleteCollection.isPending}
              onClick={() => {
                deleteCollection.mutate(collection.slug, {
                  onSettled: () => setDeleteDialogOpen(false),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
