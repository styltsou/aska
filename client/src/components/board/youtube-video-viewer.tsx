import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLinkIcon, PlayIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { LinkAsset } from "@/types/asset";

type VideoLinkAsset = LinkAsset & { video: NonNullable<LinkAsset["video"]> };

export function YouTubeVideoViewer({
  asset,
  onClose,
}: {
  asset?: LinkAsset;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [activeAsset, setActiveAsset] = useState<VideoLinkAsset>();

  useEffect(() => {
    if (isVideoLinkAsset(asset)) setActiveAsset(asset);
  }, [asset]);

  const displayedAsset = isVideoLinkAsset(asset) ? asset : activeAsset;
  if (!displayedAsset) return null;
  const open = asset !== undefined;
  const accessibleDescription = `Watch ${displayedAsset.title} without leaving Aska.`;

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(next) => !next && onClose()}
        swipeDirection="down"
        showSwipeHandle
        fast
      >
        <DrawerContent
          className="gap-0 overflow-hidden border-border/70 bg-background p-0 text-foreground shadow-2xl"
          style={
            {
              "--drawer-content-max-height":
                "calc(100dvh - var(--app-shell-inset))",
              "--bleed": "0px",
            } as CSSProperties
          }
        >
          <DrawerTitle className="sr-only">{displayedAsset.title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {accessibleDescription}
          </DrawerDescription>
          <VideoViewerContent
            key={displayedAsset.video.videoId}
            asset={displayedAsset}
            closeControl={
              <DrawerClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="border-white/10 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
                    aria-label="Close video"
                  />
                }
              >
                <XIcon />
              </DrawerClose>
            }
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-1/2 w-[calc(100vw-2rem)] max-w-[60rem] -translate-y-1/2 overflow-hidden rounded-xl shadow-2xl ring-1 ring-foreground/10"
      >
        <DialogTitle className="sr-only">{displayedAsset.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {accessibleDescription}
        </DialogDescription>
        <DialogBody className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-xl border-0 bg-background p-0">
          <VideoViewerContent
            key={displayedAsset.video.videoId}
            asset={displayedAsset}
            closeControl={
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="border-white/10 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
                    aria-label="Close video"
                  />
                }
              >
                <XIcon />
              </DialogClose>
            }
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function VideoViewerContent({
  asset,
  closeControl,
}: {
  asset: VideoLinkAsset;
  closeControl: ReactNode;
}) {
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const embedUrl = youtubeEmbedUrl(asset.video.videoId);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative isolate aspect-video shrink-0 overflow-hidden bg-neutral-950">
        {asset.previewImage ? (
          <>
            <img
              src={asset.previewImage.url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl saturate-125"
            />
            <img
              src={asset.previewImage.url}
              alt=""
              aria-hidden="true"
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
                playerLoaded ? "opacity-0" : "opacity-90",
              )}
            />
            <div className="absolute inset-0 bg-black/25" aria-hidden="true" />
          </>
        ) : null}

        <iframe
          src={embedUrl}
          title={asset.title}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setPlayerLoaded(true)}
          className={cn(
            "absolute inset-0 size-full border-0 transition-opacity duration-300 motion-reduce:transition-none",
            playerLoaded ? "opacity-100" : "opacity-0",
          )}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent p-3 sm:p-4">
          <div className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2.5 text-xs font-medium text-white/90 backdrop-blur-md">
            <PlayIcon className="size-3.5 fill-red-500 text-red-500" />
            YouTube
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5">
            <Button
              render={
                <a
                  href={asset.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open on YouTube in a new tab"
                />
              }
              variant="ghost"
              size="sm"
              className="border-white/10 bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
            >
              Open on YouTube
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
            {closeControl}
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/70 bg-background px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="font-heading text-lg leading-snug font-medium text-balance sm:text-xl">
          {asset.title}
        </h2>
        {asset.video.channelName ? (
          asset.video.channelUrl ? (
            <a
              href={asset.video.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {asset.video.channelName}
              <ExternalLinkIcon className="size-3.5" />
              <span className="sr-only">Opens channel in a new tab</span>
            </a>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              {asset.video.channelName}
            </p>
          )
        ) : null}
        {asset.description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
            {asset.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function isVideoLinkAsset(
  asset: LinkAsset | undefined,
): asset is VideoLinkAsset {
  return asset?.video?.provider === "youtube";
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
}
