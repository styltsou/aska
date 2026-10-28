import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import type { MentionColors } from "@/api/collection/types";

import { NoteMarkdown } from "./note-asset-card";

const NOTE_PREVIEW_REFERENCE_WIDTH = 360;

export function NoteMiniature({
  content,
  title,
  mentionColors,
}: {
  content: string;
  title?: string | null;
  mentionColors?: MentionColors;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [hasOverflow, setHasOverflow] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measureWidth = () => {
      if (container.clientWidth > 0)
        setScale(container.clientWidth / NOTE_PREVIEW_REFERENCE_WIDTH);
    };
    measureWidth();
    const observer = new ResizeObserver(measureWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const contentElement = contentRef.current;
    if (!container || !contentElement) return;

    const measure = () => {
      setHasOverflow(
        contentElement.offsetHeight * scale > container.clientHeight + 1,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(contentElement);
    return () => observer.disconnect();
  }, [content, title, mentionColors, scale]);

  const contentStyle: CSSProperties = {
    width: `${100 / scale}%`,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        ref={contentRef}
        className="box-border p-4 [&_.note-card-preview-title]:mb-3"
        style={contentStyle}
      >
        <NoteMarkdown
          content={content}
          title={title}
          mentionColors={mentionColors}
        />
      </div>
      {hasOverflow ? (
        <div
          className="absolute inset-x-0 bottom-0 bg-linear-to-b from-sidebar/0 via-sidebar/85 to-sidebar"
          style={{ height: 64 * scale }}
        />
      ) : null}
    </div>
  );
}
