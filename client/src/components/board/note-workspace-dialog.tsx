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
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="note-workspace-backdrop"
        className="fixed inset-0 z-[49] bg-sidebar duration-150 motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="note-workspace-content"
        className={cn(
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed inset-0 z-50 flex h-dvh w-dvw flex-col overflow-hidden bg-sidebar text-sidebar-foreground duration-150 outline-none data-closed:pointer-events-none motion-reduce:animate-none",
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
