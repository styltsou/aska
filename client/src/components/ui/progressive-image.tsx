import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { motion, type MotionStyle } from "motion/react";
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
  const [decodedSrc, setDecodedSrc] = useState<string | null>(() =>
    decodedSources.has(src) ? src : null,
  );
  const isDecoded = decodedSrc === src || decodedSources.has(src);
  const showFallback = Boolean(fallbackSrc) && !isDecoded;

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
        rememberDecodedSource(src);
        setDecodedSrc(src);
      };

      const image = event.currentTarget;
      if (typeof image.decode === "function") {
        void image.decode().then(markDecoded).catch(markDecoded);
        return;
      }

      markDecoded();
    },
    [onLoad, src],
  );

  const handleError = useCallback<
    NonNullable<ProgressiveImageProps["onError"]>
  >(
    (event) => {
      onError?.(event);
      // A failed signed URL should not hide the still-valid local preview.
      if (!fallbackSrc) setDecodedSrc(src);
    },
    [fallbackSrc, onError, src],
  );

  return (
    <>
      {blurDataURL && !showFallback && !isDecoded ? (
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
      <motion.img
        {...props}
        src={src}
        alt={alt}
        className={cn(className, "transition-opacity")}
        style={{
          ...style,
          opacity: isDecoded || (!blurDataURL && !fallbackSrc) ? 1 : 0,
        }}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}
