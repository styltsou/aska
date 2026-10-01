import { Button } from "@/components/ui/button";
import { NOTE_CONTENT_LIMIT_MESSAGE } from "@/lib/note-content";
import type { NoteAsset } from "@/types/asset";

export function NoteSaveFeedback({
  state,
  serverNote,
  loadingServerNote,
  hasSaveableDraft,
  contentTooLong,
  onCopyDraft,
  onReviewServer,
  onReplaceServer,
  onClose,
}: {
  state: "error" | "conflict";
  serverNote?: NoteAsset;
  loadingServerNote: boolean;
  hasSaveableDraft: boolean;
  contentTooLong: boolean;
  onCopyDraft: () => void;
  onReviewServer: () => void;
  onReplaceServer: () => void;
  onClose: () => void;
}) {
  if (state === "error") {
    return (
      <div className="absolute right-4 bottom-4 left-4 z-10 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive backdrop-blur-sm sm:right-auto sm:left-6">
        <p>
          {contentTooLong ? `${NOTE_CONTENT_LIMIT_MESSAGE} ` : ""}
          Couldn’t save your changes. They’re still here. Keep editing to retry,
          or close this note and return later.
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <section
      role="alert"
      className="absolute right-4 bottom-4 left-4 z-10 max-h-[min(60vh,28rem)] overflow-y-auto rounded-lg border border-destructive/20 bg-background p-4 text-xs shadow-lg sm:right-auto sm:left-6 sm:w-[min(34rem,calc(100%-3rem))]"
    >
      <p className="font-medium text-destructive">
        This note changed elsewhere. Your edits are still here.
      </p>
      <p className="mt-1 text-muted-foreground">
        Compare the latest saved version before choosing which changes to keep.
        You can close this note and return later.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCopyDraft}>
          Copy my edits
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingServerNote}
          onClick={onReviewServer}
        >
          {loadingServerNote ? "Loading…" : "Compare versions"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {serverNote ? (
        <div className="mt-3 border-t pt-3">
          <p className="font-medium">Latest saved version</p>
          {serverNote.title ? (
            <p className="mt-1 font-medium">{serverNote.title}</p>
          ) : null}
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap">
            {serverNote.content || "(empty note)"}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="mt-3"
            disabled={loadingServerNote}
            onClick={onReplaceServer}
          >
            {hasSaveableDraft
              ? "Replace latest version with my edits"
              : "Delete note"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
