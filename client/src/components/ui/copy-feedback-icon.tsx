import { CheckIcon, CopyIcon, type LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";

type CopyFeedbackIconProps = LucideProps & { copied: boolean };

/** Crossfade the copy acknowledgement without changing the icon's footprint. */
export function CopyFeedbackIcon({
  copied,
  className,
  size,
  style,
  ...props
}: CopyFeedbackIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-4 shrink-0 align-middle",
        className,
      )}
      style={{ width: size, height: size, ...style }}
    >
      <CopyIcon
        {...props}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-150 ease-in-out motion-reduce:transition-none",
          copied ? "opacity-0" : "opacity-100",
        )}
      />
      <CheckIcon
        {...props}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-150 ease-in-out motion-reduce:transition-none",
          copied ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
