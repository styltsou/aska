import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { motion, type MotionStyle } from "motion/react";
import {
  rememberPresignedImageUrl,
  resolvePresignedImageUrl,
} from "@/lib/presigned-image-url";
import { cn } from "@/lib/utils";

type ProgressiveImageProps = Omit<
  ComponentProps<typeof motion.img>,
  "src" | "style"
> & {
  src: string;
  /** A local Blob preview to keep visible while `src` finishes decoding. */
  fallbackSrc?: string;
  blurDataURL?: string | null;
  placeholderClassName?: string;
  style?: MotionStyle;
};

const decodedSources = new Set<string>();
const MAX_DECODED_SOURCE_CACHE_SIZE = 500;

function rememberDecodedSource(src: string) {
  decodedSources.delete(src);
  decodedSources.add(src);

  if (decodedSources.size > MAX_DECODED_SOURCE_CACHE_SIZE) {
    decodedSources.delete(decodedSources.values().next().value!);
  }
}

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
  const resolvedSrc = resolvePresignedImageUrl(src);
  const [decodedSrc, setDecodedSrc] = useState<string | null>(() =>
    decodedSources.has(resolvedSrc) ? resolvedSrc : null,
  );
  const isDecoded =
    decodedSrc === resolvedSrc || decodedSources.has(resolvedSrc);
  const previousDecodedSrc =
    decodedSrc && decodedSrc !== resolvedSrc ? decodedSrc : null;
  const showFallback = Boolean(fallbackSrc) && !isDecoded;

  useEffect(() => {
    rememberPresignedImageUrl(src);
  }, [src]);

  useEffect(() => {
    if (!isDecoded || !fallbackSrc?.startsWith("blob:")) return;

    // Let the decoded remote image paint once before releasing the local Blob.
    const frame = requestAnimationFrame(() => URL.revokeObjectURL(fallbackSrc));
    return () => cancelAnimationFrame(frame);
  }, [fallbackSrc, isDecoded]);

  const handleLoad = useCallback<NonNullable<ProgressiveImageProps["onLoad"]>>(
    (event) => {
      onLoad?.(event);

      const markDecoded = () => {
        rememberDecodedSource(resolvedSrc);
        setDecodedSrc(resolvedSrc);
      };

      const image = event.currentTarget;
      if (typeof image.decode === "function") {
        void image.decode().then(markDecoded).catch(markDecoded);
        return;
      }

      markDecoded();
    },
    [onLoad, resolvedSrc],
  );

  const handleError = useCallback<
    NonNullable<ProgressiveImageProps["onError"]>
  >(
    (event) => {
      onError?.(event);
      // A failed signed URL should not hide the still-valid local preview.
      if (!fallbackSrc && !previousDecodedSrc) setDecodedSrc(resolvedSrc);
    },
    [fallbackSrc, onError, previousDecodedSrc, resolvedSrc],
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
        src={resolvedSrc}
        alt={alt}
        className={cn(className, "transition-opacity")}
        style={{
          ...style,
          opacity:
            isDecoded || (!blurDataURL && !fallbackSrc && !previousDecodedSrc)
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
