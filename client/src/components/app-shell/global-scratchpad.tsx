import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

const SCRATCHPAD_EASE = [0.22, 1, 0.36, 1] as const;
const SCRATCHPAD_TRANSITION = { duration: 0.08, ease: SCRATCHPAD_EASE };
const CARD_ENTER_TRANSITION = { duration: 0.14, ease: SCRATCHPAD_EASE };
const CARD_EXIT_TRANSITION = { duration: 0.09, ease: SCRATCHPAD_EASE };

export function GlobalScratchpad() {
  const shouldReduceMotion = useReducedMotion();
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
  const [phase, setPhase] = useState<"open" | "closing">("open");
  const trimmedContent = content.trim();
  const canSave = trimmedContent.length > 0 && !createInboxNote.isPending;

  const finishCloseRef = useRef(finishClose);
  finishCloseRef.current = finishClose;

  useEffect(() => {
    if (open) {
      setPhase("open");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (phase === "closing") {
      const timer = setTimeout(() => finishCloseRef.current(), 90);
      return () => clearTimeout(timer);
    }
  }, [open, phase]);

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

  function finishClose() {
    closeScratchpadState();
    setContent("");
    createInboxNote.reset();
  }

  function closeScratchpad() {
    if (phase === "closing") return;
    setPhase("closing");
  }

  function handleSave() {
    if (phase !== "open" || !canSave) {
      return;
    }

    const noteContent = trimmedContent;
    if (isNoteContentTooLong(noteContent)) {
      toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
      return;
    }
    const toastId = toast.success("Saved to Inbox.");
    void createInboxNote.mutateAsync({ content: noteContent }).catch((err) => {
      toast.dismiss(toastId);
      toast.error(getUserFacingApiErrorMessage(err, "Unable to save note."), {
        action: {
          label: "Copy draft",
          onClick: () => {
            void navigator.clipboard
              .writeText(noteContent)
              .then(() => toast.success("Draft copied."))
              .catch(() => toast.error("Could not copy draft."));
          },
        },
      });
    });
    closeScratchpad();
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="global-scratchpad"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            shouldReduceMotion ? { duration: 0 } : SCRATCHPAD_TRANSITION
          }
          className="fixed inset-0 z-[100] bg-black/10 px-3 pt-[18vh] supports-backdrop-filter:backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeScratchpad();
            }
          }}
        >
          <div
            className={cn(
              "relative mx-auto w-full max-w-md text-foreground",
              phase === "open" ? "" : "pointer-events-none",
            )}
          >
            <motion.div
              key="scratchpad-card"
              initial={{ opacity: 0, scale: 0.98, y: 4 }}
              animate={
                phase === "open"
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 0, scale: 1, y: -4 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : phase === "open"
                    ? CARD_ENTER_TRANSITION
                    : CARD_EXIT_TRANSITION
              }
              className={cn(
                "relative overflow-hidden rounded-lg",
                GLASS_FRAME_CLASS,
              )}
            >
              <div className="relative z-10 rounded-b-lg border-b border-foreground/10 bg-background">
                <textarea
                  ref={inputRef}
                  rows={1}
                  spellCheck={false}
                  className="block max-h-40 min-h-16 w-full resize-none overflow-y-auto rounded-md border-0 bg-transparent px-3 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-50"
                  disabled={phase !== "open" || createInboxNote.isPending}
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
              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 px-2.5 py-2 text-xs leading-4 text-muted-foreground">
                <span className="mr-auto inline-flex items-center gap-1">
                  <Kbd
                    variant="solid"
                    className="h-4 min-w-4 px-0.5 text-muted-foreground"
                  >
                    Esc
                  </Kbd>
                  <span>to close</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <KbdGroup className="gap-0.5">
                    <Kbd
                      variant="solid"
                      className="h-4 min-w-4 px-0.5 text-muted-foreground"
                    >
                      Shift
                    </Kbd>
                    <span>+</span>
                    <Kbd
                      variant="solid"
                      className="h-4 min-w-4 px-0.5 text-muted-foreground"
                    >
                      Enter
                    </Kbd>
                  </KbdGroup>
                  <span>for new line</span>
                </span>
                <span className="ml-2 inline-flex items-center gap-1">
                  <Kbd
                    variant="solid"
                    className="h-4 min-w-4 px-0.5 text-muted-foreground"
                  >
                    Enter
                  </Kbd>
                  <span>to save</span>
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
