import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

export function NoteWorkspace({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="note-workspace" {...props} />;
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
      <DialogPrimitive.Popup
        data-slot="note-workspace-content"
        className={cn(
          "fixed inset-0 z-50 flex h-dvh w-dvw flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition duration-100 outline-none data-ending-style:pointer-events-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
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
