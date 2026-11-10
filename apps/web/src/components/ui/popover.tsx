import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import {
  FLOATING_MENU_SURFACE_CLASS,
  FLOATING_SOLID_PANEL_SURFACE_CLASS,
  type FloatingPanelSurface,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  positionerClassName,
  align = "center",
  alignOffset = 0,
  anchor,
  side = "bottom",
  sideOffset = 4,
  surface = "glass",
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
  > & { surface?: FloatingPanelSurface; positionerClassName?: string }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        side={side}
        sideOffset={sideOffset}
        className={cn("isolate z-[90]", positionerClassName)}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-[90] flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-lg p-2.5 text-sm outline-hidden transition-[scale,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.99] data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none motion-reduce:transition-none",
            surface === "solid"
              ? FLOATING_SOLID_PANEL_SURFACE_CLASS
              : FLOATING_MENU_SURFACE_CLASS,
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
