import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ArrowUp, Check, RotateCcw, Square } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

/**
 * Inline one-line prompt rendered inside the note, directly below the content
 * the AI is writing. Output streams straight into the note as pending blocks;
 * leaving the bar keeps it, and Discard (or undo afterwards) removes it.
 */
export function NoteAiPrompt({ editor }: { editor: Editor }) {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("prompt");
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef("");
  const frameRef = useRef<number | null>(null);
  const lastRequestRef = useRef<AiRequest | null>(null);
  const keepWhenDoneRef = useRef(false);
  const runningRef = useRef(false);
  const closingRef = useRef(false);
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

  const flush = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (outputRef.current) setNoteAiContent(editor, outputRef.current);
  };

  // Ending from inside the bar returns focus to the editor *before* the bar is
  // removed; otherwise the removed input drops focus to the surrounding
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
    end(acceptNoteAiSession, options);
  };
  const discard = (options?: { fromBlur?: boolean }) => {
    end(discardNoteAiSession, options);
  };

  const finish = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    flush();
    setNoteAiStreaming(editor, false);
    if (!outputRef.current) {
      setPhase(lastRequestRef.current?.draft ? "review" : "prompt");
    } else {
      setPhase("review");
    }
    if (keepWhenDoneRef.current) {
      keepWhenDoneRef.current = false;
      if (outputRef.current) keep({ fromBlur: true });
      else discard({ fromBlur: true });
      return;
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
          setNoteAiContent(editor, outputRef.current);
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

  // Escape belongs to the bar: stop writing, or close it (keeping any output).
  // Handled in the window capture phase so the enclosing note drawer never
  // reads the press as a request to close the note.
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
      {/* Same surface as the app's Input: a hairline field that sits in the
          document rather than floating above it. */}
      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border border-input bg-transparent pr-1.5 pl-3 transition-colors duration-100 dark:bg-input/30",
          // The bar is always the focused thing while open, so a ring would be
          // noise; a slightly stronger border is enough.
          "focus-within:border-foreground/20",
        )}
      >
        <input
          ref={inputRef}
          autoFocus
          value={prompt}
          readOnly={phase === "streaming"}
          aria-label="Ask AI"
          aria-busy={phase === "streaming"}
          placeholder={
            phase === "streaming"
              ? "Writing…"
              : phase === "review"
                ? "Tell AI what to change…"
                : "Ask AI to write anything…"
          }
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (phase === "streaming") return;
              if (prompt.trim()) submit();
              else if (phase === "review") keep();
              return;
            }
            if (
              event.key === "Backspace" &&
              (event.metaKey || event.ctrlKey) &&
              !prompt &&
              phase === "review"
            ) {
              event.preventDefault();
              discard();
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex shrink-0 items-center gap-1">
          {phase === "review" && !prompt.trim() ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Discard (Ctrl+Backspace)"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => discard()}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Try again"
                title="Try again"
                onMouseDown={(event) => event.preventDefault()}
                onClick={retry}
              >
                <RotateCcw />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                title="Keep (Enter)"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => keep()}
              >
                <Check data-icon="inline-start" />
                Keep
              </Button>
            </>
          ) : phase === "streaming" ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Stop"
              title="Stop (Esc)"
              onMouseDown={(event) => event.preventDefault()}
              onClick={stop}
            >
              <Square className="size-2.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="icon-sm"
              aria-label="Send"
              disabled={!prompt.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={submit}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mt-1 px-1 text-xs text-destructive">{error}</p>
      ) : null}
    </motion.div>
  );
}

function lastDraft(
  request: AiRequest | null,
  output: { current: string },
): string {
  return output.current || request?.draft || "";
}
