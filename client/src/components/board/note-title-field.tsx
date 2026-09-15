import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const NoteTitleField = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    onEnter?: () => void;
    autoFocus?: boolean;
    readOnly?: boolean;
    className?: string;
  }
>(function NoteTitleField(
  { value, onChange, onBlur, onEnter, autoFocus, readOnly = false, className },
  ref,
) {
  return (
    <input
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          event.preventDefault();
          onEnter?.();
        }
      }}
      autoFocus={autoFocus}
      readOnly={readOnly}
      maxLength={255}
      placeholder="Untitled"
      aria-label="Note title"
      className={cn(
        "w-full border-0 bg-transparent px-0 text-3xl leading-tight font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/55 focus:ring-0 sm:text-4xl",
        className,
      )}
    />
  );
});
