import type { CSSProperties } from "react";

import { NoteMarkdown } from "./note-asset-card";

const MINIATURE_STYLES: Record<"folder" | "collection", CSSProperties> = {
  folder: {
    width: "200%",
    transform: "scale(0.5)",
    transformOrigin: "top left",
  },
  collection: {
    width: "166.6667%",
    transform: "scale(0.6)",
    transformOrigin: "top left",
  },
};

export function NoteMiniature({
  content,
  title,
  size,
}: {
  content: string;
  title?: string | null;
  size: "folder" | "collection";
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="box-border p-4 [&_.note-card-preview-title]:mb-3"
        style={MINIATURE_STYLES[size]}
      >
        <NoteMarkdown content={content} title={title} />
      </div>
    </div>
  );
}
