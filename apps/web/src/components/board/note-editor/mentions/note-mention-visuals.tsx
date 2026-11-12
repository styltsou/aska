import { useState, type CSSProperties, type ReactNode } from "react";
import {
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  PlayIcon,
  VideoIcon,
} from "lucide-react";
import type {
  NoteMentionTarget,
  NoteMentionType,
} from "@/api/note-mentions/types";
import {
  gradientRepresentativeColor,
  resolveGradientCss,
} from "@/lib/color-gradient";
import { cn } from "@/lib/utils";

// Static pills (canvas cards, folder and collection previews) are read-only, so
// the base class carries no hover. Only the editor's interactive pill opts in.
const MENTION_CHIP_BASE_CLASS =
  "mx-[0.08em] inline-flex max-w-full items-center gap-1 rounded-md border border-foreground/10 bg-[color-mix(in_oklab,var(--background)_var(--mention-background-rest,90%),var(--mention-tint,var(--foreground)))] px-1.5 py-0.5 align-baseline text-[0.875em] leading-none font-medium text-foreground no-underline transition-[background-color,border-color,box-shadow,opacity] duration-100";
export const NOTE_MENTION_CHIP_CLASS = MENTION_CHIP_BASE_CLASS;
export const NOTE_MENTION_CHIP_HOVER_CLASS =
  "cursor-pointer hover:border-foreground/20 hover:bg-[color-mix(in_oklab,var(--background)_var(--mention-background-hover,85%),var(--mention-tint,var(--foreground)))] active:bg-[color-mix(in_oklab,var(--background)_var(--mention-background-active,80%),var(--mention-tint,var(--foreground)))]";
export const NOTE_MENTION_SELECTED_CLASS = "ring-2 ring-ring/35";
export const NOTE_MENTION_UNAVAILABLE_CLASS =
  "cursor-default border-transparent bg-muted/45 text-muted-foreground opacity-65 grayscale";
export const NOTE_MENTION_GLYPH_CLASS = "size-3.5 shrink-0 -translate-y-px";
export const NOTE_MENTION_SWATCH_CLASS = `${NOTE_MENTION_GLYPH_CLASS} rounded-[0.2rem] border border-foreground/15`;

export function MentionGlyph({
  assetType,
  swatchBackground,
  previewUrl,
  faviconUrl,
  isVideo,
  scaleToText = false,
}: {
  assetType: NoteMentionType;
  swatchBackground?: string;
  previewUrl?: string | null;
  faviconUrl?: string | null;
  isVideo?: boolean;
  scaleToText?: boolean;
}) {
  const glyphClass = cn(
    NOTE_MENTION_GLYPH_CLASS,
    scaleToText && "size-[1em] -translate-y-[0.07em]",
  );
  const thumbnailIconClass = cn(
    "text-foreground/75",
    scaleToText ? "size-[0.857em]" : "size-3",
  );
  if (assetType === "note") {
    return (
      <FileTextIcon
        aria-hidden="true"
        className={glyphClass}
        strokeWidth={2.5}
      />
    );
  }
  if (assetType === "link" || assetType === "video") {
    return (
      <LinkMentionThumbnail
        previewUrl={previewUrl ?? undefined}
        faviconUrl={faviconUrl ?? undefined}
        isVideo={isVideo || assetType === "video"}
        className={glyphClass}
        iconClassName={thumbnailIconClass}
      />
    );
  }
  if (assetType === "image") {
    return (
      <ImageMentionThumbnail
        previewUrl={previewUrl ?? undefined}
        className={glyphClass}
        iconClassName={thumbnailIconClass}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        NOTE_MENTION_SWATCH_CLASS,
        glyphClass,
        !swatchBackground && "bg-muted",
      )}
      style={{ background: swatchBackground }}
    />
  );
}

export function MentionPillBody({
  assetType,
  label,
  swatchBackground,
  previewUrl,
  faviconUrl,
  isVideo,
  scaleToText = false,
}: {
  assetType: NoteMentionType;
  label: ReactNode;
  swatchBackground?: string;
  previewUrl?: string | null;
  faviconUrl?: string | null;
  isVideo?: boolean;
  scaleToText?: boolean;
}) {
  return (
    <>
      <MentionGlyph
        assetType={assetType}
        swatchBackground={swatchBackground}
        previewUrl={previewUrl}
        faviconUrl={faviconUrl}
        isVideo={isVideo}
        scaleToText={scaleToText}
      />
      <span className="max-w-64 truncate leading-[1.2]">{label}</span>
    </>
  );
}

export function LinkMentionThumbnail({
  previewUrl,
  faviconUrl,
  isVideo,
  showVideoBadge = false,
  videoBadgeSize = "normal",
  className,
  iconClassName,
}: {
  previewUrl?: string;
  faviconUrl?: string;
  isVideo?: boolean;
  showVideoBadge?: boolean;
  videoBadgeSize?: "small" | "normal";
  className: string;
  iconClassName: string;
}) {
  const [failedPreview, setFailedPreview] = useState<string>();
  const [failedFavicon, setFailedFavicon] = useState<string>();
  const Icon = isVideo ? VideoIcon : LinkIcon;
  const imageUrl =
    previewUrl && failedPreview !== previewUrl
      ? previewUrl
      : faviconUrl && failedFavicon !== faviconUrl
        ? faviconUrl
        : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[0.2rem] bg-muted",
        className,
      )}
    >
      <Icon className={cn("absolute", iconClassName)} />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "absolute inset-0 size-full",
            imageUrl === faviconUrl ? "object-contain p-px" : "object-cover",
          )}
          onError={() => {
            if (imageUrl === previewUrl) setFailedPreview(imageUrl);
            else setFailedFavicon(imageUrl);
          }}
        />
      ) : null}
      {imageUrl && isVideo && showVideoBadge ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-black/65 text-white shadow-sm",
              videoBadgeSize === "small" ? "size-4" : "size-5",
            )}
          >
            <PlayIcon
              className={cn(
                "fill-current",
                videoBadgeSize === "small" ? "size-2" : "size-2.5",
              )}
            />
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function ImageMentionThumbnail({
  previewUrl,
  className,
  iconClassName,
}: {
  previewUrl?: string;
  className: string;
  iconClassName: string;
}) {
  const [failedPreview, setFailedPreview] = useState<string>();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[0.2rem] bg-muted",
        className,
      )}
    >
      {!previewUrl || failedPreview === previewUrl ? (
        <ImageIcon className={cn("absolute", iconClassName)} />
      ) : (
        <img
          src={previewUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedPreview(previewUrl)}
        />
      )}
    </span>
  );
}

export function mentionSwatchBackground(resolved?: NoteMentionTarget) {
  if (!resolved) return undefined;
  if (resolved.gradient) return resolveGradientCss(resolved.gradient);
  return resolved.hex ?? undefined;
}

export function mentionTint(
  assetType: NoteMentionType,
  resolved?: NoteMentionTarget,
) {
  if (assetType !== "color" || !resolved) return null;
  return resolved.gradient
    ? gradientRepresentativeColor(resolved.gradient)
    : resolved.hex;
}

export function mentionPillStyle(
  tint?: string | null,
): CSSProperties | undefined {
  if (!tint) return undefined;
  return {
    "--mention-tint": tint,
    "--mention-background-rest": "80%",
    "--mention-background-hover": "75%",
    "--mention-background-active": "75%",
  } as CSSProperties;
}
