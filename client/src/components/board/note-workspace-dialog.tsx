import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { useCoordinatedModalOpen } from "@/hooks/use-modal-escape-layer";

export function NoteWorkspace({
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
      data-slot="note-workspace"
      {...props}
      open={modal.open}
      onOpenChange={modal.handleOpenChange}
    />
  );
}

export function NoteWorkspaceTrigger({
  ...props
}: DialogPrimitive.Trigger.Props) {
  return (
    <DialogPrimitive.Trigger data-slot="note-workspace-trigger" {...props} />
  );
}

export function NoteWorkspaceContent({
  className,
  backdropClassName,
  children,
  ...props
}: DialogPrimitive.Popup.Props & { backdropClassName?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="note-workspace-backdrop"
        className={cn(
          "fixed inset-0 z-[49] bg-black/10 transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
          backdropClassName,
        )}
      />
      <DialogPrimitive.Popup
        data-slot="note-workspace-content"
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden text-sidebar-foreground duration-150 outline-none data-closed:pointer-events-none motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export function NoteWorkspaceTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="note-workspace-title"
      className={cn("sr-only", className)}
      {...props}
    />
  );
}
