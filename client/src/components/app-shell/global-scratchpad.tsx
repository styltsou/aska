import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

import { useCreateInboxNote } from "@/api/collection";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { useEventListener } from "@/hooks/use-event-listener";

import { KEYBINDINGS } from "@/lib/keybindings";

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
      className="fixed inset-0 z-50 bg-black/5 px-3 pt-[18vh] supports-backdrop-filter:backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeScratchpad();
        }
      }}
    >
      <div className="mx-auto w-full max-w-md rounded-xl bg-popover px-3 py-2 text-popover-foreground shadow-2xl ring-1 ring-foreground/10">
        <textarea
          ref={inputRef}
          rows={1}
          className="block max-h-32 min-h-5 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-50"
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
    </div>,
    document.body,
  );
}
