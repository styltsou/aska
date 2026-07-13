import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { cn } from "@/lib/utils";

import { NoteMarkdown } from "./board/cards/note-asset-card";
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FolderChildPreview } from "@/api/collection/types";

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

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={(triggerProps) => (
            <Link
              {...triggerProps}
              to="/$workspaceSlug/collections/$"
              search={{ note: undefined, image: undefined }}
              params={{ workspaceSlug, _splat: collection.slug }}
              className="relative cursor-pointer overflow-hidden rounded-lg border bg-sidebar transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-foreground/20"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <div className="relative flex aspect-3/2 items-center justify-center overflow-hidden bg-sidebar/50">
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
                        <ProgressiveImage
                          src={preview.url}
                          blurDataURL={preview.blurDataURL}
                          alt=""
                          className="absolute rounded-xl object-cover shadow-md ring-1 ring-sidebar-foreground/5"
                          style={{
                            zIndex: 0,
                            width: "60%",
                            height: "60%",
                            top: "50%",
                            left: "50%",
                            translate: "-50% -50%",
                            transform: `rotate(-3deg) scale(${hovered ? 1.03 : 1})`,
                            transformOrigin: "bottom center",
                            transition:
                              "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                            willChange: "transform",
                          }}
                        />
                      );
                    }
                    return (
                      <div
                        className={cn(
                          "ring-sidebar-foreground/5 absolute flex flex-col items-start justify-start gap-0.5 overflow-hidden rounded-xl px-3 pt-3 pb-0 shadow-md ring-1",
                          !preview.color && "bg-card",
                        )}
                        style={{
                          zIndex: 0,
                          width: "60%",
                          height: "60%",
                          top: "50%",
                          left: "50%",
                          translate: "-50% -50%",
                          transform: `rotate(-3deg) scale(${hovered ? 1.03 : 1})`,
                          transformOrigin: "bottom center",
                          transition:
                            "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                          ...(preview.color
                            ? { backgroundColor: preview.color }
                            : {}),
                        }}
                      >
                        {preview.snippet ? (
                          <NoteMarkdown
                            content={preview.snippet}
                            className="text-xs leading-[1.2] [&_a]:!text-xs [&_blockquote]:!text-xs [&_code]:!text-xs [&_h1]:!my-0 [&_h1]:!text-xs [&_h2]:!my-0 [&_h2]:!text-xs [&_h3]:!my-0 [&_h3]:!text-xs [&_li]:!my-0 [&_li]:!text-xs [&_ol]:!my-0 [&_p]:!my-0 [&_p]:!text-xs [&_pre]:!text-xs [&_ul]:!my-0"
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
                    const deg = (i - (count - 1) / 2) * 4;
                    const hovDeg = (i - (count - 1) / 2) * 16;
                    const x = (i - (count - 1) / 2) * 4;
                    const y = i * 5;
                    const hoverX = (i - (count - 1) / 2) * 12;
                    const hoverY = Math.abs(i - (count - 1) / 2) * 3 - 3;
                    const z = count - 1 - i;

                    if (preview.type === "image" && preview.url) {
                      return (
                        <ProgressiveImage
                          key={preview.assetId}
                          src={preview.url}
                          blurDataURL={preview.blurDataURL}
                          alt=""
                          className="absolute rounded-xl object-cover shadow-md ring-1 ring-sidebar-foreground/5"
                          style={{
                            zIndex: z,
                            width: "60%",
                            height: "60%",
                            top: "50%",
                            left: "50%",
                            translate: hovered
                              ? `calc(-50% + ${hoverX}px) calc(-50% + ${hoverY}px)`
                              : `calc(-50% + ${x}px) calc(-50% + ${y}px)`,
                            transform: `rotate(${hovered ? hovDeg : deg}deg) scale(${hovered ? 1.035 : 1})`,
                            transformOrigin: "bottom center",
                            transitionDelay: hovered
                              ? `${z * 18}ms`
                              : `${i * 10}ms`,
                            transition:
                              "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), translate 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                            willChange: "transform, translate",
                          }}
                        />
                      );
                    }
                    return (
                      <div
                        key={preview.assetId}
                        className={cn(
                          "ring-sidebar-foreground/5 absolute flex flex-col items-start justify-start gap-0.5 overflow-hidden rounded-xl px-3 pt-3 pb-0 shadow-md ring-1",
                          !preview.color && "bg-card",
                        )}
                        style={{
                          zIndex: z,
                          width: "60%",
                          height: "60%",
                          top: "50%",
                          left: "50%",
                          translate: hovered
                            ? `calc(-50% + ${hoverX}px) calc(-50% + ${hoverY}px)`
                            : `calc(-50% + ${x}px) calc(-50% + ${y}px)`,
                          transform: `rotate(${hovered ? hovDeg : deg}deg) scale(${hovered ? 1.035 : 1})`,
                          transformOrigin: "bottom center",
                          transitionDelay: hovered
                            ? `${z * 18}ms`
                            : `${i * 10}ms`,
                          transition:
                            "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), translate 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                          ...(preview.color
                            ? { backgroundColor: preview.color }
                            : {}),
                        }}
                      >
                        {preview.snippet ? (
                          <NoteMarkdown
                            content={preview.snippet}
                            className="text-xs leading-[1.2] [&_a]:!text-xs [&_blockquote]:!text-xs [&_code]:!text-xs [&_h1]:!my-0 [&_h1]:!text-xs [&_h2]:!my-0 [&_h2]:!text-xs [&_h3]:!my-0 [&_h3]:!text-xs [&_li]:!my-0 [&_li]:!text-xs [&_ol]:!my-0 [&_p]:!my-0 [&_p]:!text-xs [&_pre]:!text-xs [&_ul]:!my-0"
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
              <div className="flex items-center gap-2 bg-sidebar/60 px-3 py-2.5 backdrop-blur-sm">
                <span className="truncate text-sm font-medium">
                  {collection.name}
                </span>
                <span className="ml-auto text-xs text-sidebar-foreground/40">
                  {collection.assetCount}
                </span>
              </div>
            </Link>
          )}
        />
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/${workspaceSlug}/collections/${collection.slug}`,
              );
            }}
          >
            Copy link to collection
          </ContextMenuItem>
          <ContextMenuSeparator />
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
          <AlertDialogHeader>
            <AlertDialogTitle>Delete collection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{collection.name}</strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
