import type { ComponentProps } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NoteScrollAreaProps = ComponentProps<typeof ScrollArea>;

export function NoteScrollArea({
  className,
  viewportClassName,
  verticalScrollbarClassName,
  verticalThumbClassName,
  ...props
}: NoteScrollAreaProps) {
  return (
    <ScrollArea
      className={cn("group/note-scroll-area", className)}
      viewportClassName={cn(
        "note-workspace-scroll-container",
        viewportClassName,
      )}
      verticalScrollbarClassName={cn(
        "w-[5px] p-0 opacity-100 data-hovering:opacity-100 data-scrolling:opacity-100",
        verticalScrollbarClassName,
      )}
      verticalScrollbarStyle={{
        top: "4px",
        bottom: "4px",
        insetInlineEnd: "2px",
      }}
      verticalThumbClassName={cn(
        "w-[5px] rounded-full bg-sidebar-foreground/16 transition-colors duration-150 group-hover/note-scroll-area:bg-sidebar-foreground/24",
        verticalThumbClassName,
      )}
      {...props}
    />
  );
}
