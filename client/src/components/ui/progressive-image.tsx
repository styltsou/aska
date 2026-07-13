import { useCallback, useState, type ComponentProps } from "react";
import { motion, type MotionStyle } from "motion/react";
import { cn } from "@/lib/utils";

type ProgressiveImageProps = Omit<
  ComponentProps<typeof motion.img>,
  "src" | "style"
> & {
  src: string;
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
      setDecodedSrc(src);
    },
    [onError, src],
  );

  return (
    <>
      {blurDataURL && !isDecoded ? (
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
      <motion.img
        {...props}
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: isDecoded || !blurDataURL ? 1 : 0,
        }}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}
