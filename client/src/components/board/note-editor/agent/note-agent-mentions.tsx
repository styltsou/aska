import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileTextIcon, XIcon } from "lucide-react";

import {
  mentionSearchQueryOptions,
  type NoteMentionTarget,
} from "@/api/note-mentions";
import { NOTE_MENTION_CHIP_CLASS } from "@/components/board/note-editor/mentions/note-mentions";
import { cn } from "@/lib/utils";

/**
 * @-mentioning notes in the agent prompt: typing `@` opens a note picker, picked
 * notes show as chips in the prompt, and their IDs go with the next request
 * (and its follow-ups); the server loads their content as context.
 */

export type NoteAgentMentionedNote = { assetId: number; title: string };

// Mirrors the server's limits.
const MAX_MENTIONED_NOTES = 3;
const PICKER_LIMIT = 6;

/** The `@query` being typed right before the caret, if any. */
export function mentionQueryBefore(text: string, caret: number) {
  const match = /(?:^|\s)@([^\s@]{0,40})$/.exec(text.slice(0, caret));
  if (!match) return null;
  return {
    text: match[1] ?? "",
    start: caret - match[1]!.length - 1,
    end: caret,
  };
}

export function useNoteAgentMentions({
  workspaceSlug,
  sourceAssetId,
}: {
  workspaceSlug?: string;
  sourceAssetId?: number;
}) {
  const [notes, setNotes] = useState<NoteAgentMentionedNote[]>([]);
  const [query, setQuery] = useState<ReturnType<
    typeof mentionQueryBefore
  > | null>(null);
  const [active, setActive] = useState(0);

  const enabled =
    Boolean(workspaceSlug) &&
    query !== null &&
    notes.length < MAX_MENTIONED_NOTES;
  const search = useQuery({
    ...mentionSearchQueryOptions(workspaceSlug ?? "", {
      q: query?.text ?? "",
      types: ["note"],
      limit: PICKER_LIMIT,
      sourceAssetId,
    }),
    enabled,
  });
  const options = enabled
    ? (search.data?.targets ?? []).filter(
        (target) => !notes.some((note) => note.assetId === target.assetId),
      )
    : [];

  /** Call on every input change with the new value and caret. */
  const update = (value: string, caret: number) => {
    setQuery(mentionQueryBefore(value, caret));
    setActive(0);
  };

  /** Adds `target` and returns the prompt text without the `@query`. */
  const pick = (target: NoteMentionTarget, value: string) => {
    if (!query) return value;
    setNotes((current) =>
      current.some((note) => note.assetId === target.assetId)
        ? current
        : [
            ...current,
            { assetId: target.assetId, title: target.title || target.label },
          ],
    );
    setQuery(null);
    return value.slice(0, query.start) + value.slice(query.end);
  };

  return {
    notes,
    open: enabled,
    options,
    active,
    loading: enabled && search.isFetching && !search.data,
    update,
    pick,
    close: () => setQuery(null),
    move: (delta: number) =>
      setActive((index) =>
        options.length ? (index + delta + options.length) % options.length : 0,
      ),
    remove: (assetId: number) =>
      setNotes((current) => current.filter((note) => note.assetId !== assetId)),
  };
}

export function NoteAgentMentionChips({
  notes,
  onRemove,
}: {
  notes: NoteAgentMentionedNote[];
  onRemove: (assetId: number) => void;
}) {
  return notes.map((note) => (
    <span
      key={note.assetId}
      className={cn(NOTE_MENTION_CHIP_CLASS, "shrink-0 gap-0.5")}
    >
      <FileTextIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="max-w-28 truncate">{note.title || "Untitled"}</span>
      <button
        type="button"
        aria-label={`Remove ${note.title || "Untitled"}`}
        className="-mr-0.5 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onRemove(note.assetId)}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  ));
}

export function NoteAgentMentionPicker({
  id,
  options,
  active,
  loading,
  onPick,
}: {
  id: string;
  options: NoteMentionTarget[];
  active: number;
  loading: boolean;
  onPick: (target: NoteMentionTarget) => void;
}) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Notes"
      className="absolute top-full left-0 z-50 mt-1 w-72 max-w-full rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {options.length ? (
        options.map((target, index) => (
          <button
            key={target.assetId}
            type="button"
            role="option"
            aria-selected={index === active}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(target)}
          >
            <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {target.title || target.label || "Untitled"}
            </span>
          </button>
        ))
      ) : (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">
          {loading ? "Searching…" : "No matching notes"}
        </p>
      )}
    </div>
  );
}
