import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

import { useCreateInboxNote } from "@/api/collection";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { useEventListener } from "@/hooks/use-event-listener";

import { KEYBINDINGS } from "@/lib/keybindings";
import { GLASS_FRAME_CLASS, GLASS_SURFACE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

export function GlobalScratchpad() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const workspaceSlug = pathname.split("/")[1] || "";
  const createInboxNote = useCreateInboxNote(workspaceSlug);
  const hasActiveModalLayer = useActiveModalLayer();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const trimmedContent = content.trim();
  const canSave = trimmedContent.length > 0 && !createInboxNote.isPending;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.style.height = "0px";
    input.style.height = `${input.scrollHeight}px`;
  }, [content, open]);

  useEventListener("keydown", (event) => {
    if (event.repeat || hasActiveModalLayer || open || !workspaceSlug) {
      return;
    }

    const isShortcut =
      event.shiftKey && event.code === KEYBINDINGS.SCRATCHPAD_OPEN.code;

    if (!isShortcut) {
      return;
    }

    event.preventDefault();
    setOpen(true);
  });

  function closeScratchpad({
    resetMutation = true,
  }: { resetMutation?: boolean } = {}) {
    setOpen(false);
    setContent("");
    if (resetMutation) {
      createInboxNote.reset();
    }
  }

  function handleSave() {
    if (!canSave) {
      return;
    }

    const noteContent = trimmedContent;
    closeScratchpad({ resetMutation: false });
    toast.success("Saved to Inbox");

    createInboxNote.mutate(
      { content: noteContent },
      {
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Unable to save note.",
          );
        },
      },
    );
  }

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/10 px-3 pt-[18vh] supports-backdrop-filter:backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeScratchpad();
        }
      }}
    >
      <div className="relative mx-auto w-full max-w-md text-foreground">
        <div className={cn("relative rounded-lg p-1.5", GLASS_FRAME_CLASS)}>
          <div className={cn("relative z-10 rounded-md", GLASS_SURFACE_CLASS)}>
            <textarea
              ref={inputRef}
              rows={1}
              className="block max-h-32 min-h-5 w-full resize-none overflow-y-auto rounded-md border-0 bg-transparent px-3 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-50"
              disabled={createInboxNote.isPending}
              placeholder="Capture to Inbox..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeScratchpad();
                  return;
                }

                const isSaveKey =
                  event.key === "Enter" &&
                  (!event.shiftKey || event.metaKey || event.ctrlKey) &&
                  !event.nativeEvent.isComposing;

                if (isSaveKey) {
                  event.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 px-0 pt-[7px] pr-[2px] text-[10px] leading-4 text-muted-foreground">
            <span className="mr-auto inline-flex items-center gap-1">
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
              <span>Close</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <KbdGroup className="gap-0.5">
                <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Shift</Kbd>
                <span className="text-muted-foreground/50">+</span>
                <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Enter</Kbd>
              </KbdGroup>
              <span>New line</span>
            </span>
            <span className="ml-2 inline-flex items-center gap-1">
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Enter</Kbd>
              <span>Save</span>
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
