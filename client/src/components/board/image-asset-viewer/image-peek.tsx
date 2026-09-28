import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { fetchAssetImageBlob } from "@/api/collection/fetchers";
import { Button } from "@/components/ui/button";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyImageToClipboard } from "@/lib/clipboard";
import type { ImageAsset } from "@/types/asset";

import { ImageColorPalette, ImageMetadataDetails } from "./image-metadata";
import { useImageNoteEditor } from "./use-image-note-editor";

const MIN_HERO_HEIGHT = 304;

function ImagePeekBlur({ src }: { src: string }) {
  return (
    <>
      <img
        src={src}
        alt=""
        className="absolute top-1/2 left-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 scale-[2.2] object-cover blur-2xl saturate-150 [@media(prefers-reduced-transparency:reduce)]:hidden"
      />
      <div className="absolute inset-0 bg-neutral-950/50" />
    </>
  );
}

function getSourceLabel(asset: ImageAsset): string {
  if (asset.sourceLabel) return asset.sourceLabel;
  if (!asset.sourceUrl) return "Source";

  try {
    return new URL(asset.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return asset.sourceUrl;
  }
}

export function ImagePeek({
  asset,
  workspaceSlug,
  onAssetChange,
  setFlushHandler,
}: {
  asset: ImageAsset;
  workspaceSlug: string;
  onAssetChange: (asset: ImageAsset) => void;
  setFlushHandler: (handler?: () => Promise<void>) => void;
}) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { note, onChange, flush } = useImageNoteEditor({
    asset,
    workspaceSlug,
    onSaved: onAssetChange,
  });

  useEffect(() => {
    setFlushHandler(async () => {
      await flush();
    });
    return () => setFlushHandler(undefined);
  }, [flush, setFlushHandler]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    const hero = heroRef.current;
    if (!viewport || !hero) return;

    let frame: number | null = null;
    let lastViewportHeight = -1;
    const updateHeroHeight = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const scrollTop = viewport.scrollTop;
        const viewportHeight = viewport.clientHeight;
        const maxHeight = Math.max(
          MIN_HERO_HEIGHT,
          Math.min(window.innerHeight * 0.7, 640),
        );
        const height = Math.max(MIN_HERO_HEIGHT, maxHeight - scrollTop);
        hero.style.height = `${height}px`;
        hero.style.marginBottom = `${maxHeight - height}px`;
        viewport.style.setProperty("--image-peek-hero-height", `${height}px`);
        if (viewportHeight !== lastViewportHeight) {
          lastViewportHeight = viewportHeight;
          viewport.style.setProperty(
            "--image-peek-min-content-height",
            `${Math.max(0, viewportHeight - MIN_HERO_HEIGHT)}px`,
          );
        }
      });
    };

    viewport.addEventListener("scroll", updateHeroHeight, { passive: true });
    window.addEventListener("resize", updateHeroHeight);
    const resizeObserver = new ResizeObserver(updateHeroHeight);
    resizeObserver.observe(viewport);
    updateHeroHeight();

    return () => {
      viewport.removeEventListener("scroll", updateHeroHeight);
      window.removeEventListener("resize", updateHeroHeight);
      resizeObserver.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  const imageUrl = asset.originalUrl ?? asset.url;
  const imageWidth = asset.originalWidth ?? asset.width;
  const imageHeight = asset.originalHeight ?? asset.height;
  const aspectRatio =
    imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;

  return (
    <ScrollArea
      className="z-10 min-h-0 min-w-0 flex-1 rounded-t-xl border-t border-foreground/10 bg-background"
      viewportRef={scrollViewportRef}
      viewportClassName="rounded-t-xl overscroll-contain"
    >
      <div
        ref={heroRef}
        className="[container-type:size] sticky top-0 isolate z-10 flex min-h-76 items-center justify-center overflow-hidden rounded-t-[calc(var(--radius-xl)-1px)] bg-neutral-950 p-5 shadow-[0_10px_24px_-20px_rgb(0_0_0_/_0.8)]"
        style={{ height: "min(70dvh, 40rem)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <ImagePeekBlur src={asset.url} />
        </div>
        <div
          className="relative isolate overflow-hidden rounded-lg"
          style={{
            width: `min(100cqw, calc(100cqh * ${aspectRatio}))`,
            height: `min(100cqh, calc(100cqw / ${aspectRatio}))`,
            clipPath: "inset(0 round var(--radius-lg))",
          }}
        >
          <ProgressiveImage
            src={imageUrl}
            fallbackSrc={
              asset.localPreviewUrl ??
              (asset.originalUrl && asset.originalUrl !== asset.url
                ? asset.url
                : undefined)
            }
            blurDataURL={asset.uploadStatus ? undefined : asset.blurDataURL}
            alt={asset.alt ?? asset.title ?? ""}
            className="absolute inset-0 size-full rounded-[inherit] object-cover"
            loading="eager"
          />
        </div>
      </div>

      <div className="relative z-0 flex min-h-(--image-peek-min-content-height) flex-col bg-neutral-950">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-4 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden bg-neutral-950"
            style={{
              height: "var(--image-peek-hero-height, min(70dvh, 40rem))",
            }}
          >
            <ImagePeekBlur src={asset.url} />
          </div>
        </div>
        <div className="relative flex flex-1 flex-col rounded-t-xl border-t border-border bg-background">
          <div className="min-w-0 flex-1 space-y-5 px-5 py-5">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Title
              </span>
              <p className="mt-1 text-sm font-medium wrap-break-word text-foreground">
                {asset.title ?? "Untitled image"}
              </p>
            </div>

            {asset.sourceUrl ? (
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Source
                </span>
                <a
                  href={asset.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-primary transition-colors hover:text-foreground"
                >
                  <ExternalLinkIcon className="size-3.5 shrink-0" />
                  {getSourceLabel(asset)}
                </a>
              </div>
            ) : null}

            <ImageColorPalette asset={asset} compact />

            <div>
              <label
                htmlFor={`peek-image-note-${asset.id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Notes
              </label>
              <AutoResizeTextarea
                id={`peek-image-note-${asset.id}`}
                spellCheck={false}
                value={note}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Add a note"
                rows={1}
                className="mt-1 block min-h-6 w-full border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
              />
            </div>
          </div>

          <footer className="mt-auto shrink-0 px-5 pb-5">
            <div className="border-t border-border pt-4">
              <ImageMetadataDetails asset={asset} />
            </div>
          </footer>
        </div>
      </div>
    </ScrollArea>
  );
}

export function ImagePeekHeaderActions({
  asset,
  workspaceSlug,
}: {
  asset: ImageAsset;
  workspaceSlug: string;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    try {
      await copyImageToClipboard(async () => {
        if (!asset.uploadStatus) {
          return fetchAssetImageBlob(workspaceSlug, asset.id);
        }

        const response = await fetch(
          asset.localPreviewUrl ?? asset.originalUrl ?? asset.url,
        );
        if (!response.ok) throw new Error("Unable to copy image.");
        return response.blob();
      });
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to copy image.",
      );
    }
  }, [asset, workspaceSlug]);

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = `/api/v1/workspace/${workspaceSlug}/assets/${encodeURIComponent(asset.id)}/download`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [asset.id, workspaceSlug]);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label={copied ? "Copied image" : "Copy image"}
              onClick={() => void handleCopy()}
            />
          }
        >
          <CopyFeedbackIcon copied={copied} className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {copied ? "Copied image" : "Copy image"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label="Download"
              onClick={handleDownload}
            />
          }
        >
          <DownloadIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Download</TooltipContent>
      </Tooltip>
    </>
  );
}
