import { useEffect, useRef } from "react";
import { FolderIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

export function FolderComposer({
  open,
  onOpenChange,
  name,
  onNameChange,
  pending,
  error,
  canCreate,
  busy,
  onCreate,
  suppressFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  pending: boolean;
  error?: string;
  canCreate: boolean;
  busy: boolean;
  onCreate: () => void;
  suppressFocusRef: React.MutableRefObject<boolean>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (wasOpen.current && !open && buttonRef.current) {
      if (!suppressFocusRef.current) {
        buttonRef.current.focus({ preventScroll: true });
      }
      suppressFocusRef.current = false;
    }
    wasOpen.current = open;
  }, [open, suppressFocusRef]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
        onNameChange("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onOpenChange, onNameChange]);

  if (!canCreate) return null;

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        disabled={busy}
        onClick={() => onOpenChange(true)}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed bg-foreground/[0.02]">
          <PlusIcon className="size-4" />
        </div>
        <span className="font-medium">New folder</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="rounded-md px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.04]">
          {pending ? (
            <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <FolderIcon className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="relative flex-1">
          <Input
            autoFocus
            aria-label="New folder name"
            autoComplete="off"
            disabled={busy}
            placeholder="Folder name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreate();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onOpenChange(false);
                onNameChange("");
              }
            }}
            className="h-8 w-full pr-24"
          />
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <kbd className="rounded border border-border/70 bg-muted px-1 font-sans text-[10px] leading-4 text-muted-foreground">
              Enter
            </kbd>
            to create
          </span>
        </div>
      </div>
      {error ? (
        <p className="mt-1.5 px-0.5 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
