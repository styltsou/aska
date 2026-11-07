import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ArrowUp, Check, RotateCcw } from "lucide-react";
import { motion } from "motion/react";

import {
  acceptNoteAiSession,
  discardNoteAiSession,
  noteMarkdownAtAiCursor,
  NOTE_AI_CURSOR_MARKER,
  setNoteAiContent,
  setNoteAiStreaming,
} from "@/components/board/note-editor/ai/note-ai-session";
import {
  streamNoteAi,
  type NoteAiRequest as AiRequest,
} from "@/components/board/note-editor/ai/note-ai-stream";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * - `prompt`: asking for the first draft.
 * - `streaming`: the AI is writing into the note; a status line, no input.
 * - `review`: a draft is in the note; an action row to retry, discard or keep
 *   it, with a follow-up input below that rewrites the same draft.
 */
type Phase = "prompt" | "streaming" | "review";

// Mirrors the server's note limit; long notes keep the text around the cursor.
const NOTE_CONTEXT_LIMIT = 38_000;

function trimAroundCursor(note: string) {
  if (note.length <= NOTE_CONTEXT_LIMIT) return note;
  const cursor = Math.max(0, note.indexOf(NOTE_AI_CURSOR_MARKER));
  const start = Math.max(
    0,
    Math.min(
      cursor - NOTE_CONTEXT_LIMIT * 0.7,
      note.length - NOTE_CONTEXT_LIMIT,
    ),
  );
  return note.slice(Math.floor(start), Math.floor(start) + NOTE_CONTEXT_LIMIT);
}

export type NoteAiDraft = { draft: string; request: AiRequest };

/**
 * Inline AI controls rendered inside the note, directly below the content the
 * AI is writing. Output streams straight into the note as a pending draft;
 * leaving keeps it, and Discard (or undo afterwards) removes it.
 *
 * `restored` reopens a draft saved on an earlier visit, in review and without
 * taking focus. `onDraft` reports each finished draft so it can be stored, and
 * `onResolve` reports that the user kept or discarded it.
 */
export function NoteAiPrompt({
  editor,
  restored,
  onDraft,
  onResolve,
}: {
  editor: Editor;
  restored?: NoteAiDraft;
  onDraft?: (draft: NoteAiDraft) => void;
  onResolve?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>(restored ? "review" : "prompt");
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef(restored?.draft ?? "");
  const frameRef = useRef<number | null>(null);
  const lastRequestRef = useRef<AiRequest | null>(restored?.request ?? null);
  // A restored draft waits quietly in the note; it only takes focus once the
  // user interacts with it.
  const skipInitialFocusRef = useRef(Boolean(restored));
  const keepWhenDoneRef = useRef(false);
  const runningRef = useRef(false);
  const closingRef = useRef(false);
  // Set while focus moves between the input and the status line, so
  // the hand-off isn't mistaken for the user leaving.
  const handingOffRef = useRef(false);
  const pointerDownRef = useRef(false);

  useEffect(() => {
    const down = () => {
      pointerDownRef.current = true;
    };
    const up = () => {
      pointerDownRef.current = false;
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
    };
  }, []);
  // The note as it was when the bar opened; follow-ups revise the draft
  // against this same context.
  const noteRef = useRef<string | null>(null);
  noteRef.current ??= trimAroundCursor(noteMarkdownAtAiCursor(editor));

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (restored) setNoteAiContent(editor, restored.draft);
    // Only on mount: `restored` describes where this session started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each state owns one focus target; move focus there whenever it changes.
  useLayoutEffect(() => {
    if (closingRef.current) return;
    if (skipInitialFocusRef.current) {
      skipInitialFocusRef.current = false;
      handingOffRef.current = false;
      return;
    }
    const target = phase === "streaming" ? statusRef.current : inputRef.current;
    target?.focus({ preventScroll: true });
    // A long draft can push the controls below the fold; bring them back.
    target?.scrollIntoView({ block: "nearest" });
    handingOffRef.current = false;
  }, [phase]);

  const handOff = () => {
    handingOffRef.current = true;
    // The focus effect clears this; the timeout is a backstop in case a state
    // change turns out not to move focus.
    window.setTimeout(() => {
      handingOffRef.current = false;
    }, 0);
  };

  const flush = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (outputRef.current) setNoteAiContent(editor, outputRef.current);
  };

  // Ending from inside the bar returns focus to the editor *before* the bar is
  // removed; otherwise the removed element drops focus to the surrounding
  // drawer. Ending because focus already left keeps the user's new selection.
  const end = (
    action: typeof acceptNoteAiSession,
    { fromBlur = false } = {},
  ) => {
    if (!fromBlur) {
      closingRef.current = true;
      editor.view.focus();
    }
    action(editor, { select: !fromBlur });
  };
  const keep = (options?: { fromBlur?: boolean }) => {
    flush();
    onResolve?.();
    end(acceptNoteAiSession, options);
  };
  const discard = (options?: { fromBlur?: boolean }) => {
    onResolve?.();
    end(discardNoteAiSession, options);
  };

  const finish = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    flush();
    setNoteAiStreaming(editor, false);
    if (keepWhenDoneRef.current) {
      keepWhenDoneRef.current = false;
      if (outputRef.current) keep({ fromBlur: true });
      else discard({ fromBlur: true });
      return;
    }
    handOff();
    if (!outputRef.current) {
      setPhase(lastRequestRef.current?.draft ? "review" : "prompt");
    } else {
      setPhase("review");
      if (lastRequestRef.current) {
        onDraft?.({
          draft: outputRef.current,
          request: lastRequestRef.current,
        });
      }
    }
  };

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      abortRef.current?.abort();
      abortRef.current = null;
      // Don't end the session here: StrictMode replays this cleanup right
      // after mount, and the bar only really unmounts once the session has
      // ended or the editor itself is going away.
    },
    [],
  );

  const run = (request: AiRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isCurrent = () => abortRef.current === controller;

    lastRequestRef.current = request;
    outputRef.current = "";
    keepWhenDoneRef.current = false;
    runningRef.current = true;
    handOff();
    setError("");
    setPrompt("");
    setPhase("streaming");
    setNoteAiStreaming(editor, true);

    streamNoteAi(request, {
      signal: controller.signal,
      onDelta: (text) => {
        if (!isCurrent()) return;
        outputRef.current += text;
        frameRef.current ??= requestAnimationFrame(() => {
          frameRef.current = null;
          // Follow the writing only while it's on screen, so scrolling up to
          // read isn't yanked back down.
          const status = statusRef.current;
          const following = status ? isInViewport(status) : false;
          setNoteAiContent(editor, outputRef.current);
          if (following) status?.scrollIntoView({ block: "nearest" });
        });
      },
    })
      .catch((cause: unknown) => {
        if (!isCurrent() || controller.signal.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "AI generation failed.",
        );
      })
      .finally(() => {
        if (!isCurrent()) return;
        abortRef.current = null;
        finish();
      });
  };

  const submit = () => {
    const instruction = prompt.trim();
    if (!instruction || phase === "streaming") return;
    const draft =
      phase === "review" ? lastDraft(lastRequestRef.current, outputRef) : "";
    run({
      prompt: instruction,
      note: noteRef.current ?? "",
      ...(draft ? { draft } : {}),
    });
  };

  const retry = () => {
    if (lastRequestRef.current) run(lastRequestRef.current);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    finish();
  };

  // Escape steps back one level: stop writing, or close (a
  // draft is kept, an empty prompt just closes). Handled in the window capture
  // phase so the enclosing note drawer never reads it as "close the note".
  const escapeRef = useRef(() => {});
  escapeRef.current = () => {
    if (phase === "streaming") stop();
    else if (phase === "review") keep();
    else discard();
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      if (
        !(event.target instanceof Node) ||
        !containerRef.current?.contains(event.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      escapeRef.current();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="note-ai-prompt my-1.5 font-sans text-sm"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (
          closingRef.current ||
          handingOffRef.current ||
          // Switching windows blurs too; the bar should still be there.
          !document.hasFocus() ||
          (next instanceof Node && containerRef.current?.contains(next))
        ) {
          return;
        }
        if (phase === "streaming") {
          keepWhenDoneRef.current = true;
          return;
        }
        const leave = () => {
          // Focus may have come back to the bar while the click finished.
          if (containerRef.current?.contains(document.activeElement)) return;
          if (phase === "review") keep({ fromBlur: true });
          else discard({ fromBlur: true });
        };
        // When a click moved focus away, let the editor place the caret
        // first; changing the document mid-click would move the caret and
        // lose focus to the surrounding drawer.
        if (pointerDownRef.current) {
          window.addEventListener(
            "pointerup",
            () => window.setTimeout(leave, 0),
            { once: true },
          );
        } else {
          leave();
        }
      }}
    >
      {phase === "streaming" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="flex h-8 items-center justify-between gap-3 outline-none"
        >
          <span className="note-ai-shimmer text-sm">Writing…</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onMouseDown={keepFocus}
            onClick={stop}
          >
            Stop
            <Kbd className="h-3.5 min-w-3.5 px-1 text-[10px]">Esc</Kbd>
          </Button>
        </div>
      ) : phase === "review" ? (
        <div
          role="toolbar"
          aria-label="AI draft"
          // Secondary actions lead into the primary one on the far right,
          // which also lines Keep up above the follow-up's send button.
          className="flex h-8 items-center justify-end gap-1"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Retry"
                  className="text-muted-foreground hover:text-foreground"
                  onMouseDown={keepFocus}
                  onClick={retry}
                />
              }
            >
              <RotateCcw />
            </TooltipTrigger>
            <TooltipContent>Retry</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onMouseDown={keepFocus}
            onClick={() => discard()}
          >
            Discard
          </Button>
          <Button
            type="button"
            variant="default"
            size="xs"
            onMouseDown={keepFocus}
            onClick={() => keep()}
          >
            <Check data-icon="inline-start" />
            Keep
            {/* Enter keeps only while the follow-up is empty. */}
            {prompt.trim() ? null : (
              <Kbd className="h-3.5 min-w-3.5 bg-transparent px-0 text-[10px] text-current opacity-60">
                ↵
              </Kbd>
            )}
          </Button>
        </div>
      ) : null}
      {phase === "streaming" ? null : (
        <div
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg border border-input bg-transparent pr-1.5 pl-3 transition-colors duration-100 focus-within:border-foreground/20 dark:bg-input/30",
            phase === "review" && "mt-1.5",
          )}
        >
          <input
            ref={inputRef}
            value={prompt}
            aria-label={
              phase === "review" ? "Ask AI to change the draft" : "Ask AI"
            }
            placeholder={
              phase === "review"
                ? "Ask a follow-up…"
                : "Ask AI to write anything…"
            }
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                // An empty Enter in review accepts the draft.
                if (prompt.trim()) submit();
                else if (phase === "review") keep();
              } else if (
                phase === "review" &&
                event.key === "Backspace" &&
                (event.metaKey || event.ctrlKey) &&
                !prompt
              ) {
                event.preventDefault();
                discard();
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="button"
            variant="default"
            size="icon-sm"
            aria-label="Send"
            disabled={!prompt.trim()}
            onMouseDown={keepFocus}
            onClick={submit}
          >
            <ArrowUp />
          </Button>
        </div>
      )}
      {error ? (
        <p className="mt-1 px-1 text-xs text-destructive">{error}</p>
      ) : null}
    </motion.div>
  );
}

function isInViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function lastDraft(
  request: AiRequest | null,
  output: { current: string },
): string {
  return output.current || request?.draft || "";
}
