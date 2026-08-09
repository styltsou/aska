import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { motion, type MotionStyle } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  reportImageDecoded,
  reportImageFailed,
} from "@/lib/image-delivery-metrics";
import { cn } from "@/lib/utils";

const MAX_DECODED_IMAGE_SOURCES = 300;
const decodedImageSources = new Set<string>();

function rememberDecodedSource(src: string) {
  decodedImageSources.add(src);

  if (decodedImageSources.size > MAX_DECODED_IMAGE_SOURCES) {
    const oldestSource = decodedImageSources.values().next().value;
    if (oldestSource) decodedImageSources.delete(oldestSource);
  }
}

type ProgressiveImageProps = Omit<
  ComponentProps<typeof motion.img>,
  "src" | "style"
> & {
  src: string;
  /** A browser preview to keep visible while `src` finishes decoding. */
  fallbackSrc?: string;
  blurDataURL?: string | null;
  placeholderClassName?: string;
  style?: MotionStyle;
};

export function ProgressiveImage({
  src,
  fallbackSrc,
  blurDataURL,
  alt = "",
  className,
  placeholderClassName,
  style,
  loading = "lazy",
  onLoad,
  onError,
  ...props
}: ProgressiveImageProps) {
  const [decodedSrc, setDecodedSrc] = useState<string | null>(null);
  const reusedDecodedSource = decodedImageSources.has(src);
  const isDecoded = decodedSrc === src || reusedDecodedSource;
  const previousDecodedSrc =
    decodedSrc && decodedSrc !== src ? decodedSrc : null;
  const showFallback = Boolean(fallbackSrc) && !isDecoded;
  const showSkeleton =
    !fallbackSrc && !blurDataURL && !isDecoded && !previousDecodedSrc;

  useEffect(() => {
    if (!isDecoded || !fallbackSrc?.startsWith("blob:")) return;

    // Let the decoded remote image paint once before releasing the local Blob.
    const frame = requestAnimationFrame(() => URL.revokeObjectURL(fallbackSrc));
    return () => cancelAnimationFrame(frame);
  }, [fallbackSrc, isDecoded]);

  const handleLoad = useCallback<NonNullable<ProgressiveImageProps["onLoad"]>>(
    (event) => {
      onLoad?.(event);

      const markDecoded = (decodeDurationMs = 0) => {
        rememberDecodedSource(src);
        setDecodedSrc(src);
        reportImageDecoded({
          src,
          image,
          loading,
          decodeDurationMs,
          reusedDecodedSource,
        });
      };

      const image = event.currentTarget;
      if (typeof image.decode === "function") {
        const decodeStartedAt = performance.now();
        const markImageDecoded = () =>
          markDecoded(performance.now() - decodeStartedAt);
        void image.decode().then(markImageDecoded).catch(markImageDecoded);
        return;
      }

      markDecoded();
    },
    [loading, onLoad, reusedDecodedSource, src],
  );

  const handleError = useCallback<
    NonNullable<ProgressiveImageProps["onError"]>
  >(
    (event) => {
      onError?.(event);
      reportImageFailed({ src, loading, reusedDecodedSource });
      if (!fallbackSrc && !previousDecodedSrc) setDecodedSrc(src);
    },
    [
      fallbackSrc,
      loading,
      onError,
      previousDecodedSrc,
      reusedDecodedSource,
      src,
    ],
  );

  return (
    <>
      {blurDataURL && !showFallback && !isDecoded && !previousDecodedSrc ? (
        <>
          <motion.img
            src={blurDataURL}
            alt=""
            aria-hidden="true"
            className={cn(
              className,
              "scale-[1.03] blur-[5px] brightness-90 saturate-75",
              placeholderClassName,
            )}
            style={style}
          />
          <motion.span
            aria-hidden="true"
            className={cn(
              className,
              "bg-background/10 pointer-events-none backdrop-blur-[1px]",
              placeholderClassName,
            )}
            style={style}
          />
        </>
      ) : null}
      {showSkeleton ? (
        <motion.div
          aria-hidden="true"
          className={cn(className, "pointer-events-none")}
          style={style}
        >
          <Skeleton className={cn("size-full", placeholderClassName)} />
        </motion.div>
      ) : null}
      {fallbackSrc ? (
        <motion.img
          src={fallbackSrc}
          alt=""
          aria-hidden="true"
          className={cn(className, "pointer-events-none transition-opacity")}
          style={{ ...style, opacity: showFallback ? 1 : 0 }}
        />
      ) : null}
      {previousDecodedSrc ? (
        <motion.img
          src={previousDecodedSrc}
          alt=""
          aria-hidden="true"
          className={cn(className, "pointer-events-none transition-opacity")}
          style={{ ...style, opacity: 1 }}
        />
      ) : null}
      <motion.img
        {...props}
        src={src}
        alt={alt}
        className={cn(className, "transition-opacity")}
        style={{
          ...style,
          opacity:
            isDecoded ||
            (!showSkeleton &&
              !blurDataURL &&
              !fallbackSrc &&
              !previousDecodedSrc)
              ? 1
              : 0,
        }}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}
