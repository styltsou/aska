import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "@tanstack/react-router";
import { FolderOpenIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { LinkCardPreview } from "./board/cards/link-asset-card";
import { NoteMiniature } from "./board/cards/note-miniature";
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
import type { WorkspaceRouteSearch } from "@/routes/$workspaceSlug/route";

const MAX_VISIBLE_PREVIEWS = 4;

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
  search: WorkspaceRouteSearch;
}

export function CollectionCard({
  collection,
  workspaceSlug,
  search,
}: CollectionCardProps) {
  const [pointerOver, setPointerOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const pointerExitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteCollection = useDeleteCollection(workspaceSlug);
  const previews = collection.previews.slice(0, MAX_VISIBLE_PREVIEWS);
  const active = pointerOver || focused;
  const stackDirection = (hashString(collection.slug) & 1) === 0 ? 1 : -1;

  useEffect(
    () => () => {
      if (pointerExitTimeout.current) clearTimeout(pointerExitTimeout.current);
    },
    [],
  );

  const handleHoverTargetEnter = () => {
    if (pointerExitTimeout.current) clearTimeout(pointerExitTimeout.current);
    pointerExitTimeout.current = null;
    setPointerOver(true);
  };

  const handleHoverTargetLeave = (event: ReactPointerEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Element &&
      nextTarget.closest("[data-collection-hover-target]")
    ) {
      return;
    }

    if (pointerExitTimeout.current) clearTimeout(pointerExitTimeout.current);
    pointerExitTimeout.current = setTimeout(() => {
      pointerExitTimeout.current = null;
      setPointerOver(false);
    }, 80);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={(triggerProps) => (
            <div className="relative">
              <Link
                {...triggerProps}
                to="/$workspaceSlug/collections/$"
                search={search}
                params={{ workspaceSlug, _splat: collection.slug }}
                className="group/card relative flex w-full min-w-0 cursor-pointer flex-col items-center gap-2.5 rounded-xl p-1.5 text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                onFocus={(event) =>
                  setFocused(event.currentTarget.matches(":focus-visible"))
                }
                onBlur={() => setFocused(false)}
              >
                <div className="pointer-events-none relative z-10 aspect-[3/2] w-full @min-[64rem]:max-h-[calc((100svh-13.75rem)/2)]">
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ containerType: "size" }}
                  >
                    {previews.length === 0 ? (
                      <EmptyCollectionPreview
                        active={active}
                        onPointerEnter={handleHoverTargetEnter}
                        onPointerLeave={handleHoverTargetLeave}
                      />
                    ) : (
                      previews.map((preview, index) => (
                        <CollectionPreviewCard
                          key={preview.assetId}
                          preview={preview}
                          index={index}
                          count={previews.length}
                          stackDirection={stackDirection}
                          active={active}
                          onPointerEnter={handleHoverTargetEnter}
                          onPointerLeave={handleHoverTargetLeave}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  data-collection-hover-target
                  onPointerEnter={handleHoverTargetEnter}
                  onPointerLeave={handleHoverTargetLeave}
                  className="absolute top-[64%] bottom-0 left-1/2 z-0 w-[68%] -translate-x-1/2"
                />

                <div
                  data-collection-hover-target
                  data-active={active}
                  onPointerEnter={handleHoverTargetEnter}
                  onPointerLeave={handleHoverTargetLeave}
                  className="relative z-10 flex max-w-full min-w-0 items-center gap-5 rounded-md bg-sidebar px-3 py-1.5 transition-colors duration-150 ease-out group-focus-visible/card:bg-sidebar-active data-[active=true]:bg-sidebar-active motion-reduce:transition-none"
                >
                  <span className="min-w-0 truncate text-sm font-medium">
                    {collection.name}
                  </span>
                  <span
                    aria-label={`${collection.assetCount} items`}
                    className="ml-auto shrink-0 text-xs text-sidebar-foreground/55 tabular-nums"
                  >
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

function EmptyCollectionPreview({
  active,
  onPointerEnter,
  onPointerLeave,
}: {
  active: boolean;
  onPointerEnter: () => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <div
      aria-hidden="true"
      data-collection-hover-target
      data-active={active}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="pointer-events-auto flex aspect-[4/3] shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-sidebar px-3 text-sidebar-foreground/55 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-[active=true]:scale-105 data-[active=true]:rotate-2 motion-reduce:transition-none"
      style={{ width: "min(68cqw, 95cqh, 12rem)" }}
    >
      <FolderOpenIcon
        className="size-7 text-sidebar-foreground/35"
        strokeWidth={1.5}
      />
      <span className="text-xs font-medium">No items yet</span>
    </div>
  );
}

function CollectionPreviewCard({
  preview,
  index,
  count,
  stackDirection,
  active,
  onPointerEnter,
  onPointerLeave,
}: {
  preview: FolderChildPreview;
  index: number;
  count: number;
  stackDirection: number;
  active: boolean;
  onPointerEnter: () => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const reduceMotion = useReducedMotion();
  const seed = hashString(preview.assetId);
  const isSinglePreview = count === 1;
  const side = (index % 2 === 0 ? 1 : -1) * stackDirection;
  const horizontalDrift = (((seed >>> 4) & 7) - 3.5) * 0.15;
  const verticalDrift = (((seed >>> 8) & 7) - 3.5) * 0.12;
  const rotationDrift = (((seed >>> 12) & 7) - 3.5) * 0.08;
  const restingX =
    (isSinglePreview || index === 0 ? 0 : side * (4 + index * 3)) +
    (isSinglePreview ? 0 : horizontalDrift);
  const restingY =
    (isSinglePreview || index === 0 ? 0 : 1 + index * 1.3) +
    (isSinglePreview ? 0 : verticalDrift);
  const restingRotation =
    (isSinglePreview ? 0 : side * (index === 0 ? 0.8 : 2 + index * 1.2)) +
    rotationDrift;
  const hoverX = isSinglePreview
    ? restingX
    : side * (index === 0 ? 3 : 8 + index * 3) + horizontalDrift;
  const hoverY = isSinglePreview
    ? restingY
    : restingY - (index === 0 ? 1.5 : 1);
  const hoverRotation = isSinglePreview
    ? restingRotation + side * 2
    : side * (index === 0 ? 3 : 5 + Math.min(index, 2) * 0.8) + rotationDrift;
  const translateX = active ? hoverX : restingX;
  const translateY = active ? hoverY : restingY;
  const rotation = active ? hoverRotation : restingRotation;
  const scale = active
    ? isSinglePreview
      ? 1.05
      : 1.015
    : 0.94 + ((seed >>> 21) & 7) / 100;

  const positionStyle: CSSProperties = {
    left: "50%",
    top: "50%",
    zIndex: count - index,
  };
  const motionPosition = {
    x: `calc(-50% + ${translateX}cqw)`,
    y: `calc(-50% + ${translateY}cqh)`,
    rotate: rotation,
    scale,
  };
  const motionTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        duration: 0.2,
        bounce: 0.42,
        delay: active ? index * 0.004 : 0,
      };

  if (preview.type === "image") {
    return preview.url ? (
      <motion.img
        data-collection-hover-target
        src={preview.url}
        alt=""
        loading="lazy"
        decoding="async"
        aria-hidden="true"
        initial={false}
        animate={motionPosition}
        transition={motionTransition}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className="pointer-events-auto absolute block h-auto max-h-[75cqh] w-auto max-w-[62cqw] rounded-lg border border-transparent object-contain"
        style={positionStyle}
      />
    ) : null;
  }

  const ratio = preview.type === "note" ? 0.82 : 1;
  const style: CSSProperties = {
    ...positionStyle,
    width:
      preview.type === "link"
        ? "min(64cqw, 62cqh)"
        : `min(62cqw, ${ratio * 75}cqh)`,
    aspectRatio: preview.type === "link" ? undefined : ratio,
  };

  return (
    <motion.div
      data-collection-hover-target
      aria-hidden="true"
      initial={false}
      animate={motionPosition}
      transition={motionTransition}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="pointer-events-auto absolute overflow-hidden rounded-lg border border-border bg-card"
      style={style}
    >
      {preview.type === "link" ? (
        <LinkCardPreview preview={preview} variant="collection" />
      ) : preview.type === "color" ? (
        <div className="size-full" style={{ backgroundColor: preview.hex }} />
      ) : (
        <div className="size-full overflow-hidden bg-sidebar">
          <NoteMiniature
            content={preview.snippet ?? ""}
            title={preview.title}
            size="collection"
          />
        </div>
      )}
    </motion.div>
  );
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
