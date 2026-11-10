import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { useCoordinatedModalOpen } from "@/hooks/use-modal-escape-layer";

function Dialog({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: DialogPrimitive.Root.Props) {
  const modal = useCoordinatedModalOpen(
    controlledOpen,
    defaultOpen,
    onOpenChange,
  );

  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      {...props}
      open={modal.open}
      onOpenChange={modal.handleOpenChange}
    />
  );
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[100] bg-black/10 transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  polishedMotion = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  overlayClassName?: string;
  polishedMotion?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay
        className={cn(
          polishedMotion &&
            "duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:duration-150 motion-reduce:duration-0 motion-reduce:data-ending-style:duration-0",
          overlayClassName,
        )}
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-[18vh] left-1/2 z-[100] w-full max-w-sm -translate-x-1/2 translate-y-0 overflow-hidden rounded-lg transition duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          polishedMotion &&
            "transition-[scale,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:scale-[0.96] data-ending-style:duration-150 data-starting-style:scale-[0.96] motion-reduce:transition-opacity motion-reduce:duration-100 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100",
          GLASS_FRAME_CLASS,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-[1.125rem] right-[1.125rem] z-20"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "relative z-10 rounded-b-lg border-b border-foreground/10 bg-background p-4 text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "relative z-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-foreground text-base font-medium",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
