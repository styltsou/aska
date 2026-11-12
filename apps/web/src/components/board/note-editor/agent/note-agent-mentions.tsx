import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";

import {
  mentionSearchQueryOptions,
  type NoteMentionTarget,
  type NoteMentionType,
} from "@/api/note-mentions";
import {
  MentionGlyph,
  mentionSwatchBackground,
  NOTE_MENTION_CHIP_CLASS,
} from "@/components/board/note-editor/mentions/note-mention-visuals";
import { cn } from "@/lib/utils";

/**
 * @-mentioning items in the agent prompt: typing `@` opens a picker of notes,
 * links, colors and images, picked items show as chips in the prompt, and their IDs go
 * with the next request (and its follow-ups); the server loads them as context.
 */

/** Types the agent can read; mirrors MENTIONABLE_TYPES on the server. */
export const AGENT_MENTION_TYPES = [
  "note",
  "link",
  "color",
  "image",
] as const satisfies readonly NoteMentionType[];

export type NoteAgentMention = NoteMentionTarget;

// Mirrors the server's limits.
const MAX_MENTIONS = 3;
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

/** What a request carries for each mention. */
export function mentionsForRequest(items: NoteAgentMention[]) {
  return items.map(({ assetId, assetType }) => ({
    assetId,
    type: assetType as (typeof AGENT_MENTION_TYPES)[number],
  }));
}

function mentionLabel(target: NoteMentionTarget) {
  return target.title || target.label || "Untitled";
}

function Glyph({ target }: { target: NoteMentionTarget }) {
  return (
    <MentionGlyph
      assetType={target.assetType}
      swatchBackground={mentionSwatchBackground(target)}
      previewUrl={target.previewUrl}
      faviconUrl={target.faviconUrl}
      isVideo={target.isVideo}
    />
  );
}

export function useNoteAgentMentions({
  workspaceSlug,
  sourceAssetId,
}: {
  workspaceSlug?: string;
  sourceAssetId?: number;
}) {
  const [items, setItems] = useState<NoteAgentMention[]>([]);
  const [query, setQuery] = useState<ReturnType<
    typeof mentionQueryBefore
  > | null>(null);
  const [active, setActive] = useState(0);

  const enabled =
    Boolean(workspaceSlug) && query !== null && items.length < MAX_MENTIONS;
  const search = useQuery({
    ...mentionSearchQueryOptions(workspaceSlug ?? "", {
      q: query?.text ?? "",
      types: AGENT_MENTION_TYPES,
      limit: PICKER_LIMIT,
      sourceAssetId,
    }),
    enabled,
  });
  const options = enabled
    ? (search.data?.targets ?? []).filter(
        (target) => !items.some((item) => item.assetId === target.assetId),
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
    setItems((current) =>
      current.some((item) => item.assetId === target.assetId)
        ? current
        : [...current, target],
    );
    setQuery(null);
    return value.slice(0, query.start) + value.slice(query.end);
  };

  return {
    items,
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
      setItems((current) => current.filter((item) => item.assetId !== assetId)),
  };
}

export function NoteAgentMentionChips({
  items,
  onRemove,
}: {
  items: NoteAgentMention[];
  onRemove: (assetId: number) => void;
}) {
  return items.map((item) => (
    <span
      key={item.assetId}
      className={cn(NOTE_MENTION_CHIP_CLASS, "shrink-0 gap-1")}
    >
      <Glyph target={item} />
      <span className="max-w-28 truncate">{mentionLabel(item)}</span>
      <button
        type="button"
        aria-label={`Remove ${mentionLabel(item)}`}
        className="-mr-0.5 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onRemove(item.assetId)}
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
      aria-label="Mentions"
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
            <Glyph target={target} />
            <span className="min-w-0 flex-1 truncate">
              {mentionLabel(target)}
            </span>
            {target.assetType === "link" && target.hostname ? (
              <span className="max-w-24 shrink-0 truncate text-xs text-muted-foreground">
                {target.hostname}
              </span>
            ) : null}
          </button>
        ))
      ) : (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">
          {loading ? "Searching…" : "No matches"}
        </p>
      )}
    </div>
  );
}
