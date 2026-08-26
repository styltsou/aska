import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { useCreateInboxNote } from "@/api/collection";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import {
  isNoteContentTooLong,
  NOTE_CONTENT_LIMIT_MESSAGE,
} from "@/lib/note-content";
import { useTransientStore } from "@/store";

const SCRATCHPAD_TRANSITION = {
  duration: 0.1,
  ease: [0, 0, 0.2, 1] as const,
};

const MORPH_TRANSITION = {
  duration: 0.16,
  ease: [0.33, 1, 0.68, 1] as const,
};

const PILL_EXIT_TRANSITION = {
  duration: 0.1,
  ease: [0.4, 0, 0.6, 1] as const,
};

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 text-primary"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function GlobalScratchpad() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const workspaceSlug = pathname.split("/")[1] || "";
  const createInboxNote = useCreateInboxNote(workspaceSlug);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const open = useTransientStore((state) => state.scratchpadOpen);
  const closeScratchpadState = useTransientStore(
    (state) => state.closeScratchpad,
  );
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState<"open" | "pill" | "leaving">("open");
  const trimmedContent = content.trim();
  const canSave = trimmedContent.length > 0 && !createInboxNote.isPending;

  const closeRef = useRef(closeScratchpad);
  closeRef.current = closeScratchpad;

  useEffect(() => {
    if (open) {
      setPhase("open");
    }
  }, [open]);

  useEffect(() => {
    if (phase === "pill") {
      const timer = setTimeout(() => setPhase("leaving"), 450);
      return () => clearTimeout(timer);
    }

    if (phase === "leaving") {
      const timer = setTimeout(() => closeRef.current(), 120);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useLayoutEffect(() => {
    if (!open || phase !== "open") {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.style.height = "0px";
    input.style.height = `${input.scrollHeight}px`;
  }, [content, open, phase]);

  function closeScratchpad({
    resetMutation = true,
  }: { resetMutation?: boolean } = {}) {
    closeScratchpadState();
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
    if (isNoteContentTooLong(noteContent)) {
      toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
      return;
    }
    setPhase("pill");

    createInboxNote.mutate(
      { content: noteContent },
      {
        onError: (err) => {
          toast.error(
            getUserFacingApiErrorMessage(err, "Unable to save note."),
          );
        },
      },
    );
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="global-scratchpad"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "leaving" ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={SCRATCHPAD_TRANSITION}
          className="fixed inset-0 z-50 bg-black/10 px-3 pt-[18vh] supports-backdrop-filter:backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeScratchpad();
            }
          }}
        >
          <div className="relative mx-auto w-full max-w-md text-foreground">
            <motion.div
              key="scratchpad-card"
              initial={{ opacity: 0, scale: 0.95, y: 6 }}
              animate={
                phase === "open"
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 0, scale: 0.96, y: -6 }
              }
              transition={MORPH_TRANSITION}
              className={cn(
                "relative overflow-hidden rounded-lg",
                phase === "open" ? "" : "pointer-events-none",
                GLASS_FRAME_CLASS,
              )}
            >
              <div className="relative z-10 rounded-b-lg border-b border-border bg-background">
                <textarea
                  ref={inputRef}
                  rows={1}
                  spellCheck={false}
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
              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
                <span className="mr-auto inline-flex items-center gap-1">
                  <Kbd
                    variant="solid"
                    className="h-4 min-w-4 px-0.5 text-[10px]"
                  >
                    Esc
                  </Kbd>
                  <span>to close</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <KbdGroup className="gap-0.5">
                    <Kbd
                      variant="solid"
                      className="h-4 min-w-4 px-0.5 text-[10px]"
                    >
                      Shift
                    </Kbd>
                    <span className="inline-flex h-4 translate-y-px items-center leading-none text-muted-foreground">
                      +
                    </span>
                    <Kbd
                      variant="solid"
                      className="h-4 min-w-4 px-0.5 text-[10px]"
                    >
                      Enter
                    </Kbd>
                  </KbdGroup>
                  <span>for new line</span>
                </span>
                <span className="ml-2 inline-flex items-center gap-1">
                  <Kbd
                    variant="solid"
                    className="h-4 min-w-4 px-0.5 text-[10px]"
                  >
                    Enter
                  </Kbd>
                  <span>to save</span>
                </span>
              </div>
            </motion.div>
            <motion.div
              key="scratchpad-pill"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={
                phase === "pill"
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.96 }
              }
              transition={
                phase === "pill" ? MORPH_TRANSITION : PILL_EXIT_TRANSITION
              }
              style={{ x: "-50%", y: "-50%" }}
              className="absolute top-1/2 left-1/2 z-10 inline-flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium whitespace-nowrap text-foreground shadow-xl ring-1 ring-border backdrop-blur"
            >
              <CheckIcon />
              <span>Saved to Inbox</span>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
