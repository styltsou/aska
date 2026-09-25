import "./note-mermaid-block.css";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { renderDiagram } from "@/lib/diagram";

export function useDiagramPreview(source: string) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!source.trim()) return;
    let active = true;
    const timer = window.setTimeout(() => {
      renderDiagram(source, dark).then(
        (result) => {
          if (!active) return;
          setSvg(result);
          setError(undefined);
        },
        (reason: unknown) => {
          if (!active) return;
          setError(
            (reason instanceof Error
              ? reason.message.replace(/^Error:\s*/, "")
              : "Unable to render diagram."
            ).slice(0, 240),
          );
        },
      );
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [source, dark]);

  return {
    svg: source.trim() ? svg : undefined,
    error: source.trim() ? error : undefined,
  };
}

export function NoteMermaidPreview({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
  const { svg, error } = useDiagramPreview(source);

  return (
    <div
      className={
        compact
          ? "note-mermaid-preview note-mermaid-preview--compact"
          : "note-mermaid-preview"
      }
    >
      {svg ? (
        <div
          className="note-mermaid-svg"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <span className="note-mermaid-message">
          {error ?? (source.trim() ? "Rendering diagram…" : "Empty diagram")}
        </span>
      )}
    </div>
  );
}
