import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  viewportClassName,
  viewportRef,
  contentClassName,
  verticalScrollbarClassName,
  verticalScrollbarStyle,
  verticalThumbClassName,
  horizontalScrollbarClassName,
  horizontalThumbClassName,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  viewportClassName?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
  contentClassName?: string;
  verticalScrollbarClassName?: string;
  verticalScrollbarStyle?: React.CSSProperties;
  verticalThumbClassName?: string;
  horizontalScrollbarClassName?: string;
  horizontalThumbClassName?: string;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn("h-full w-full rounded-[inherit]", viewportClassName)}
      >
        {contentClassName ? (
          <ScrollAreaPrimitive.Content
            className={cn("w-full min-w-0", contentClassName)}
            style={{ minWidth: 0 }}
          >
            {children}
          </ScrollAreaPrimitive.Content>
        ) : (
          children
        )}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        data-slot="scroll-area-scrollbar"
        orientation="vertical"
        className={cn(
          "absolute inset-y-0 right-0 z-10 flex w-2.5 touch-none justify-center p-0.5 opacity-0 transition-opacity duration-150 select-none data-hovering:opacity-100 data-scrolling:opacity-100",
          verticalScrollbarClassName,
        )}
        style={verticalScrollbarStyle}
      >
        <ScrollAreaPrimitive.Thumb
          data-slot="scroll-area-thumb"
          className={cn(
            "relative w-1 rounded-full bg-sidebar-foreground/20 before:absolute before:inset-0 before:-inset-x-0.5",
            verticalThumbClassName,
          )}
        />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Scrollbar
        data-slot="scroll-area-scrollbar"
        orientation="horizontal"
        className={cn(
          "flex touch-none p-0.5 opacity-0 transition-opacity duration-150 select-none data-hovering:opacity-100 data-scrolling:opacity-100",
          horizontalScrollbarClassName,
        )}
      >
        <ScrollAreaPrimitive.Thumb
          data-slot="scroll-area-thumb"
          className={cn(
            "relative h-1 rounded-full bg-sidebar-foreground/20 before:absolute before:inset-0 before:-inset-y-0.5",
            horizontalThumbClassName,
          )}
        />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}

export { ScrollArea };
