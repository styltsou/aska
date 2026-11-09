import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ArrowUp, RotateCcw } from "lucide-react";
import { motion } from "motion/react";

import {
  acceptNoteAgentSession,
  discardNoteAgentSession,
  getNoteAgentSession,
  noteAgentPassageWith,
  noteMarkdownAtAgentCursor,
  NOTE_AGENT_CURSOR_MARKER,
  setNoteAgentContent,
  setNoteAgentStreaming,
  showNoteAgentChanges,
} from "@/components/board/note-editor/agent/note-agent-session";
import {
  NoteAgentMentionChips,
  NoteAgentMentionPicker,
  useNoteAgentMentions,
} from "@/components/board/note-editor/agent/note-agent-mentions";
import {
  streamNoteAgent,
  type NoteAgentRequest as AgentRequest,
} from "@/components/board/note-editor/agent/note-agent-stream";
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
 * - `streaming`: the agent is writing into the note; a status line, no input.
 * - `review`: a draft is in the note; an action row to retry, discard or keep
 *   it, with a follow-up input below that rewrites the same draft.
 */
type Phase = "prompt" | "streaming" | "review";

// Mirrors the server's limit on instructions sent with a follow-up.
const MAX_EARLIER_PROMPTS = 10;

type QuickAction = {
  label: string;
  instruction: string;
  /** Mechanical edits skip lookups and keep everything else unchanged. */
  task?: "mechanical";
};

// One-click instructions for the most common requests, shown under the empty
// prompt. They run exactly like typed instructions.
const WRITE_ACTIONS: QuickAction[] = [
  {
    label: "Continue writing",
    instruction:
      "Continue writing from the cursor, matching the note's tone and style.",
  },
  {
    label: "Summarize",
    instruction: "Summarize the note so far in a few concise sentences.",
  },
  {
    label: "Outline",
    instruction: "Write an outline for this note as a nested list.",
  },
  {
    label: "Action items",
    instruction: "List the action items from this note as a task list.",
  },
];

const REWRITE_ACTIONS: QuickAction[] = [
  {
    label: "Improve",
    instruction:
      "Improve the writing: clearer and better flowing, same meaning and tone.",
  },
  {
    label: "Fix grammar",
    task: "mechanical",
    instruction:
      "Fix spelling, grammar, and punctuation only; change nothing else.",
  },
  {
    label: "Shorter",
    task: "mechanical",
    instruction: "Make it shorter, keeping the key points.",
  },
  {
    label: "Longer",
    task: "mechanical",
    instruction: "Make it longer, adding useful detail in the same style.",
  },
];

// Mirrors the server's note limit; long notes keep the text around the cursor.
// The whole note is sent up to this size; the server shows the model an
// outline and the part around the cursor, and lets it read the rest.
const NOTE_CONTEXT_LIMIT = 200_000;

function trimAroundCursor(note: string) {
  if (note.length <= NOTE_CONTEXT_LIMIT) return note;
  const cursor = Math.max(0, note.indexOf(NOTE_AGENT_CURSOR_MARKER));
  const start = Math.max(
    0,
    Math.min(
      cursor - NOTE_CONTEXT_LIMIT * 0.7,
      note.length - NOTE_CONTEXT_LIMIT,
    ),
  );
  return note.slice(Math.floor(start), Math.floor(start) + NOTE_CONTEXT_LIMIT);
}

export type NoteAgentDraft = { draft: string; request: AgentRequest };

/**
 * Inline agent controls rendered inside the note, directly below the content the
 * agent is writing. Output streams straight into the note as a pending draft;
 * leaving keeps it, and Discard (or undo afterwards) removes it.
 *
 * `restored` reopens a draft saved on an earlier visit, in review and without
 * taking focus. `onDraft` reports each finished draft so it can be stored, and
 * `onResolve` reports that the user kept or discarded it.
 */
export function NoteAgentPrompt({
  editor,
  restored,
  onDraft,
  onResolve,
  workspaceSlug,
  sourceAssetId,
}: {
  editor: Editor;
  restored?: NoteAgentDraft;
  onDraft?: (draft: NoteAgentDraft) => void;
  onResolve?: () => void;
  /** Enables @-mentioning notes in the prompt as context. */
  workspaceSlug?: string;
  sourceAssetId?: number;
}) {
  const [prompt, setPrompt] = useState("");
  const mentions = useNoteAgentMentions({ workspaceSlug, sourceAssetId });
  const pickerId = useId();
  const [phase, setPhase] = useState<Phase>(restored ? "review" : "prompt");
  const [error, setError] = useState("");
  // What the agent is doing before it writes (searching, reading); replaced by
  // "Writing…" once text arrives.
  const [status, setStatus] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  usePendingRail(editor, containerRef, railRef);
  const outputRef = useRef(restored?.draft ?? "");
  const frameRef = useRef<number | null>(null);
  const lastRequestRef = useRef<AgentRequest | null>(restored?.request ?? null);
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
  noteRef.current ??= trimAroundCursor(noteMarkdownAtAgentCursor(editor));
  // Set when rewriting a selection: the passage, with the selection marked.
  const passageRef = useRef<string | null | undefined>(undefined);
  passageRef.current ??= getNoteAgentSession(editor.state).passage;
  const rewriting = Boolean(passageRef.current);
  // What goes in the note for the model's output: for a rewrite, the model
  // writes only the replacement and the passage is rebuilt around it.
  const toNote = (output: string) =>
    passageRef.current
      ? noteAgentPassageWith(passageRef.current, output)
      : output;

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (restored) setNoteAgentContent(editor, restored.draft);
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
    if (outputRef.current)
      setNoteAgentContent(editor, toNote(outputRef.current));
  };

  // Ending from inside the bar returns focus to the editor *before* the bar is
  // removed; otherwise the removed element drops focus to the surrounding
  // drawer. Ending because focus already left keeps the user's new selection.
  const end = (
    action: typeof acceptNoteAgentSession,
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
    end(acceptNoteAgentSession, options);
  };
  const discard = (options?: { fromBlur?: boolean }) => {
    onResolve?.();
    end(discardNoteAgentSession, options);
  };

  const finish = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    flush();
    setNoteAgentStreaming(editor, false);
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
      // A rewrite shows what it changes in the original text. Rewrites
      // aren't stored across refreshes: they belong to text that may change.
      if (rewriting) {
        showNoteAgentChanges(editor);
      } else if (lastRequestRef.current) {
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

  const run = (request: AgentRequest) => {
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
    setStatus(null);
    setPrompt("");
    setPhase("streaming");
    setNoteAgentStreaming(editor, true);

    streamNoteAgent(request, {
      signal: controller.signal,
      onStatus: (text) => {
        if (isCurrent()) setStatus(text);
      },
      onDelta: (text) => {
        if (isCurrent()) setStatus(null);
        if (!isCurrent()) return;
        outputRef.current += text;
        frameRef.current ??= requestAnimationFrame(() => {
          frameRef.current = null;
          // Follow the writing only while it's on screen, so scrolling up to
          // read isn't yanked back down.
          const status = statusRef.current;
          const following = status ? isInViewport(status) : false;
          setNoteAgentContent(editor, toNote(outputRef.current));
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

  const submit = (text = prompt, task?: "mechanical") => {
    const instruction = text.trim();
    if (!instruction || phase === "streaming") return;
    const previous = lastRequestRef.current;
    const draft = phase === "review" ? lastDraft(previous, outputRef) : "";
    // A follow-up carries what was asked before, so "now in Spanish" still
    // knows what the draft was meant to be.
    const earlierPrompts =
      draft && previous
        ? [...(previous.earlierPrompts ?? []), previous.prompt].slice(
            -MAX_EARLIER_PROMPTS,
          )
        : [];
    const request: AgentRequest = {
      prompt: instruction,
      note: noteRef.current ?? "",
      ...(draft ? { draft } : {}),
      ...(earlierPrompts.length ? { earlierPrompts } : {}),
      ...(passageRef.current ? { passage: passageRef.current } : {}),
      ...(task ? { task } : {}),
      // Mentions go as IDs; the server loads them fresh for each request, so
      // follow-ups see their latest content.
      ...(mentions.notes.length && workspaceSlug
        ? {
            workspaceSlug,
            mentions: mentions.notes.map(({ assetId }) => ({ assetId })),
          }
        : {}),
    };
    run(request);
  };

  const retry = () => {
    if (lastRequestRef.current) run(lastRequestRef.current);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    finish();
  };

  // Escape steps back one level: stop writing, or close and drop the draft
  // (Enter is the key that keeps it). Handled in the window capture phase so
  // the enclosing note drawer never reads it as "close the note".
  const escapeRef = useRef(() => {});
  escapeRef.current = () => {
    if (mentions.open) mentions.close();
    else if (phase === "streaming") stop();
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
      className="note-agent-prompt relative my-1.5 font-sans text-sm"
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
      <span
        ref={railRef}
        aria-hidden
        data-visible="false"
        data-streaming={phase === "streaming" ? "true" : undefined}
        className="note-agent-rail"
      />
      {phase === "streaming" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="flex h-8 items-center justify-between gap-3 outline-none"
        >
          <span className="note-agent-shimmer text-sm">
            {status ?? "Writing…"}
          </span>
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
            variant="secondary"
            size="xs"
            onMouseDown={keepFocus}
            onClick={() => discard()}
          >
            Discard
            <Kbd className={actionKbd}>Esc</Kbd>
          </Button>
          <Button
            type="button"
            variant="default"
            size="xs"
            onMouseDown={keepFocus}
            onClick={() => keep()}
          >
            Keep
            {/* Enter sends a typed follow-up instead; fade rather than hide
                the hint so the row doesn't shift. */}
            <Kbd
              className={cn(
                actionKbd,
                "transition-opacity duration-100",
                prompt.trim() && "opacity-0",
              )}
            >
              ↵
            </Kbd>
          </Button>
        </div>
      ) : null}
      {phase === "streaming" ? null : (
        <div
          className={cn(
            "relative flex h-10 items-center gap-2 rounded-lg border border-input bg-transparent pr-1.5 pl-3 transition-colors duration-100 focus-within:border-foreground/20 dark:bg-input/30",
            phase === "review" && "mt-1.5",
          )}
        >
          <NoteAgentMentionChips
            notes={mentions.notes}
            onRemove={mentions.remove}
          />
          <input
            ref={inputRef}
            value={prompt}
            aria-label={
              phase === "review"
                ? "Ask AI to change the draft"
                : rewriting
                  ? "Ask AI to edit the selection"
                  : "Ask AI"
            }
            placeholder={
              (phase === "review"
                ? "Ask a follow-up"
                : rewriting
                  ? "Ask AI to edit the selection"
                  : "Ask AI to write anything") +
              // Like other AI apps, the placeholder is where @ is taught.
              // No object after "mention": notes today, other assets later.
              (workspaceSlug ? ", @ to mention…" : "…")
            }
            role="combobox"
            aria-expanded={mentions.open}
            aria-controls={mentions.open ? pickerId : undefined}
            aria-autocomplete="list"
            onChange={(event) => {
              const { value, selectionStart } = event.target;
              setPrompt(value);
              mentions.update(value, selectionStart ?? value.length);
            }}
            onKeyDown={(event) => {
              if (mentions.open) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  mentions.move(event.key === "ArrowDown" ? 1 : -1);
                  return;
                }
                const target = mentions.options[mentions.active];
                if ((event.key === "Enter" || event.key === "Tab") && target) {
                  event.preventDefault();
                  setPrompt(mentions.pick(target, prompt));
                  return;
                }
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                // An empty Enter in review accepts the draft.
                if (prompt.trim()) submit();
                else if (phase === "review") keep();
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
            onClick={() => submit()}
          >
            <ArrowUp />
          </Button>
          {mentions.open ? (
            <NoteAgentMentionPicker
              id={pickerId}
              options={mentions.options}
              active={mentions.active}
              loading={mentions.loading}
              onPick={(target) => {
                setPrompt(mentions.pick(target, prompt));
                inputRef.current?.focus();
              }}
            />
          ) : null}
        </div>
      )}
      {phase === "prompt" && !prompt ? (
        <div
          role="group"
          aria-label="Quick actions"
          className="mt-1.5 flex flex-wrap gap-1"
        >
          {(rewriting ? REWRITE_ACTIONS : WRITE_ACTIONS).map((action) => (
            <Button
              key={action.label}
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-foreground"
              onMouseDown={keepFocus}
              onClick={() => submit(action.instruction, action.task)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="mt-1 px-1 text-xs text-destructive">{error}</p>
      ) : null}
    </motion.div>
  );
}

const actionKbd =
  "h-3.5 min-w-3.5 bg-transparent px-0 text-[10px] text-current opacity-60";

/**
 * Keeps the rail beside the pending draft spanning from its first block down
 * to the bottom of these controls. It's measured rather than drawn on each
 * block, so it stays one continuous line and isn't clipped by blocks that
 * hide their overflow (code blocks, tables).
 */
function usePendingRail(
  editor: Editor,
  containerRef: React.RefObject<HTMLElement | null>,
  railRef: React.RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const container = containerRef.current;
      const rail = railRef.current;
      if (!container || !rail) return;
      const { range } = getNoteAgentSession(editor.state);
      const first = range ? editor.view.nodeDOM(range.from) : null;
      const top =
        first instanceof HTMLElement && first.offsetHeight > 0
          ? first.getBoundingClientRect().top -
            container.getBoundingClientRect().top
          : null;
      rail.style.top = top === null ? "0px" : `${Math.min(top, 0)}px`;
      rail.dataset.visible = top === null ? "false" : "true";
    };
    const schedule = () => {
      frame ??= requestAnimationFrame(measure);
    };
    measure();
    editor.on("transaction", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(editor.view.dom);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      editor.off("transaction", schedule);
      observer.disconnect();
    };
  }, [editor, containerRef, railRef]);
}

function isInViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function lastDraft(
  request: AgentRequest | null,
  output: { current: string },
): string {
  return output.current || request?.draft || "";
}
