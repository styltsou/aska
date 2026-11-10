import * as React from "react";

import { cn } from "@/lib/utils";

const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(function AutoResizeTextarea(
  { className, value, defaultValue, ...props },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);

  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const resize = React.useCallback(() => {
    const textarea = innerRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(() => {
    resize();
  }, [resize, value, defaultValue]);

  React.useEffect(() => {
    const textarea = innerRef.current;
    if (!textarea) return;

    const observer = new ResizeObserver(() => resize());
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      ref={setRef}
      data-slot="auto-resize-textarea"
      value={value}
      defaultValue={defaultValue}
      className={cn("resize-none overflow-hidden", className)}
      {...props}
    />
  );
});

export { AutoResizeTextarea };
