import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "@tanstack/react-router";
import { FolderOpenIcon, MoreHorizontalIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { LinkCardPreview } from "./board/cards/link-asset-card";
import {
  COLOR_CARD_PREVIEW_ASPECT_RATIO,
  ColorCardPreview,
} from "./board/cards/color-card-preview";
import { NoteMiniature } from "./board/cards/note-miniature";
import {
  formatVideoDuration,
  VIDEO_CARD_TIME_BADGE_CLASS,
} from "./board/video-card-control-styles";
import { useDeleteCollection } from "@/api/collection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CollectionPropertiesDialog } from "./collection-properties-dialog";
import { RenameCollectionDialog } from "./rename-collection-dialog";
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
import type {
  DetailedCollection,
  FolderChildPreview,
} from "@/api/collection/types";
import type { WorkspaceRouteSearch } from "@/routes/$workspaceSlug/route";

const MAX_VISIBLE_PREVIEWS = 4;

type CollectionCardItem = DetailedCollection;

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
  const [stackInteracted, setStackInteracted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const pointerExitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissingMenuWithCardPress = useRef(false);
  const deleteCollection = useDeleteCollection(workspaceSlug);
  const previews = collection.previews.slice(0, MAX_VISIBLE_PREVIEWS);
  const active = pointerOver || focused || actionsOpen || contextMenuOpen;
  const reduceMotion = useReducedMotion();
  const controlTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.34, 1.45, 0.64, 1] as const };
  const stackDirection = (hashString(collection.slug) & 1) === 0 ? 1 : -1;
  const collectionActions = [
    { label: "Rename", onClick: () => setRenameDialogOpen(true) },
    { label: "Properties", onClick: () => setPropertiesDialogOpen(true) },
    { label: "Delete", onClick: () => setDeleteDialogOpen(true) },
  ];
  const destructiveClass =
    "text-red-600! hover:bg-red-500/20! focus:bg-red-500/20! data-highlighted:bg-red-500/20! dark:text-red-400! dark:hover:bg-red-500/30! dark:focus:bg-red-500/30! dark:data-highlighted:bg-red-500/30!";

  useEffect(
    () => () => {
      if (pointerExitTimeout.current) clearTimeout(pointerExitTimeout.current);
    },
    [],
  );

  const handleHoverTargetEnter = () => {
    setStackInteracted(true);
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
      <ContextMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <ContextMenuTrigger
          render={
            <div className="relative flex w-full min-w-0 flex-col items-center gap-2.5 rounded-xl p-1.5 text-sidebar-foreground" />
          }
          onPointerDownCapture={(event) => {
            dismissingMenuWithCardPress.current =
              (actionsOpen || contextMenuOpen) &&
              event.target instanceof Element &&
              Boolean(event.target.closest("[data-collection-link]"));
          }}
          onClickCapture={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("[data-collection-link]") &&
              (dismissingMenuWithCardPress.current ||
                actionsOpen ||
                contextMenuOpen)
            ) {
              event.preventDefault();
              event.stopPropagation();
              setActionsOpen(false);
              setContextMenuOpen(false);
            }
            dismissingMenuWithCardPress.current = false;
          }}
        >
          <Link
            to="/$workspaceSlug/collections/$"
            search={search}
            params={{ workspaceSlug, _splat: collection.slug }}
            data-collection-link
            tabIndex={-1}
            aria-hidden="true"
            className="relative z-10 aspect-[3/2] w-full cursor-pointer @min-[64rem]:max-h-[calc((100svh-13.75rem)/2)]"
          >
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
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
                    motionEnabled={stackInteracted || active}
                    onPointerEnter={handleHoverTargetEnter}
                    onPointerLeave={handleHoverTargetLeave}
                  />
                ))
              )}
            </div>

            <div
              aria-hidden="true"
              data-collection-hover-target
              onPointerEnter={handleHoverTargetEnter}
              onPointerLeave={handleHoverTargetLeave}
              className="absolute top-[64%] -bottom-2.5 left-1/2 w-[68%] -translate-x-1/2"
            />
          </Link>
          <div className="relative z-10 flex h-8 max-w-full min-w-0 items-center justify-center">
            <motion.div
              initial={false}
              animate={{ x: active ? -19 : 0 }}
              transition={controlTransition}
              className="max-w-full min-w-0"
            >
              <Link
                to="/$workspaceSlug/collections/$"
                search={search}
                params={{ workspaceSlug, _splat: collection.slug }}
                data-collection-link
                data-collection-hover-target
                data-active={active}
                onPointerEnter={handleHoverTargetEnter}
                onPointerLeave={handleHoverTargetLeave}
                onFocus={(event) => {
                  const visible = event.currentTarget.matches(":focus-visible");
                  if (visible) setStackInteracted(true);
                  setFocused(visible);
                }}
                onBlur={() => setFocused(false)}
                className="flex h-8 max-w-full min-w-0 items-center gap-5 rounded-md px-3 text-sidebar-foreground transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none data-[active=true]:bg-sidebar-active motion-reduce:transition-none"
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
              </Link>
            </motion.div>
            <motion.div
              initial={false}
              animate={{
                x: -19,
                opacity: active ? 1 : 0,
                scale: active ? 1 : 0.98,
              }}
              transition={controlTransition}
              data-active={active}
              className="pointer-events-none absolute left-full ml-1.5 origin-left data-[active=true]:pointer-events-auto"
            >
              <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`More actions for ${collection.name}`}
                      data-collection-hover-target
                      data-active={active}
                      onPointerEnter={handleHoverTargetEnter}
                      onPointerLeave={handleHoverTargetLeave}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      className="rounded-md text-sidebar-foreground/70 hover:bg-sidebar-active hover:text-sidebar-foreground data-popup-open:bg-sidebar-active data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-foreground"
                    />
                  }
                >
                  <MoreHorizontalIcon aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="bottom"
                  className="w-40 duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-[0.99] data-ending-style:duration-150 data-starting-style:scale-[0.97] motion-reduce:transition-none"
                >
                  {collectionActions.map((action, index) => (
                    <Fragment key={action.label}>
                      {index === 2 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        className={index === 2 ? destructiveClass : undefined}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </DropdownMenuItem>
                    </Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          {collectionActions.map((action, index) => (
            <Fragment key={action.label}>
              {index === 2 ? <ContextMenuSeparator /> : null}
              <ContextMenuItem
                className={index === 2 ? destructiveClass : undefined}
                onClick={action.onClick}
              >
                {action.label}
              </ContextMenuItem>
            </Fragment>
          ))}
        </ContextMenuContent>
      </ContextMenu>
      <RenameCollectionDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        collection={collection}
        workspaceSlug={workspaceSlug}
      />
      <CollectionPropertiesDialog
        open={propertiesDialogOpen}
        onOpenChange={setPropertiesDialogOpen}
        collection={collection}
      />
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
                setDeleteDialogOpen(false);
                deleteCollection.mutate(collection.slug);
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
  motionEnabled,
  onPointerEnter,
  onPointerLeave,
}: {
  preview: FolderChildPreview;
  index: number;
  count: number;
  stackDirection: number;
  active: boolean;
  motionEnabled: boolean;
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
  const computedRestingRotation =
    (isSinglePreview ? 0 : side * (index === 0 ? 0.8 : 2 + index * 1.2)) +
    rotationDrift;
  const computedHoverX = isSinglePreview
    ? restingX
    : side * (index === 0 ? 3 : 8 + index * 3) + horizontalDrift;
  const computedHoverY = isSinglePreview
    ? restingY
    : restingY - (index === 0 ? 1.5 : 1);
  const computedHoverRotation = isSinglePreview
    ? computedRestingRotation + side * 2
    : side * (index === 0 ? 3 : 5 + Math.min(index, 2) * 0.8) + rotationDrift;
  const computedScale = active
    ? isSinglePreview
      ? 1.05
      : 1.015
    : 0.94 + ((seed >>> 21) & 7) / 100;
  const isVideoPreview = preview.type === "video";
  const translateX = active ? computedHoverX : restingX;
  const translateY = active ? computedHoverY : restingY;
  const rotation = isVideoPreview
    ? 0
    : active
      ? computedHoverRotation
      : computedRestingRotation;
  const scale = isVideoPreview ? 1 : computedScale;

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
  const motionTransition =
    reduceMotion || !motionEnabled
      ? { duration: 0 }
      : { duration: 0.3, ease: [0.34, 1.45, 0.64, 1] as const };

  if ((preview.type === "image" || preview.type === "video") && preview.url) {
    return (
      <motion.div
        data-collection-hover-target
        aria-hidden="true"
        initial={false}
        animate={motionPosition}
        transition={motionTransition}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className="pointer-events-auto absolute w-max max-w-[62cqw] overflow-hidden rounded-lg"
        style={positionStyle}
      >
        <img
          src={preview.url}
          alt=""
          aria-hidden="true"
          width={preview.width}
          height={preview.height}
          loading="lazy"
          className="block h-auto max-h-[75cqh] w-auto max-w-[62cqw] opacity-0"
        />
        <ProgressiveImage
          src={preview.url}
          blurDataURL={preview.blurDataURL}
          alt=""
          width={preview.width}
          height={preview.height}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-contain"
        />
        {preview.type === "video" && preview.durationSeconds ? (
          <span
            className={cn(
              "absolute right-2 bottom-2",
              VIDEO_CARD_TIME_BADGE_CLASS,
            )}
          >
            {formatVideoDuration(preview.durationSeconds)}
          </span>
        ) : null}
      </motion.div>
    );
  }

  const ratio =
    preview.type === "color"
      ? COLOR_CARD_PREVIEW_ASPECT_RATIO
      : preview.type === "note"
        ? 0.82
        : 1;
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
        <ColorCardPreview
          hex={preview.hex ?? undefined}
          gradient={preview.gradient}
          title={preview.title}
        />
      ) : (
        <div className="size-full overflow-hidden bg-sidebar">
          <NoteMiniature
            content={preview.snippet ?? ""}
            title={preview.title}
            mentionColors={preview.mentionColors}
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
