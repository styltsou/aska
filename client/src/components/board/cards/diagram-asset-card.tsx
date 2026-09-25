import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { PencilIcon } from "lucide-react";
import { renderDiagram } from "@/lib/diagram";
import { useWorkspaceAssetView } from "@/components/app-shell/workspace-asset-view";
import type { DiagramAsset } from "@/types/asset";
import { cn } from "@/lib/utils";

export function DiagramAssetCard({
  asset,
  onOpen,
  selected = false,
  isContextMenuOpen = false,
  canvas = false,
}: {
  asset: DiagramAsset;
  onOpen?: () => void;
  selected?: boolean;
  isContextMenuOpen?: boolean;
  canvas?: boolean;
}) {
  const { openAsset } = useWorkspaceAssetView();
  const edit = onOpen ?? (() => openAsset(asset.id));
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    let active = true;
    renderDiagram(asset.source, dark).then(
      (result) => {
        if (active) {
          setSvg(result);
          setError(undefined);
        }
      },
      (reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to render diagram.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [asset.source, dark]);

  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-center justify-center overflow-hidden rounded-lg border border-border/65 bg-card p-5 text-card-foreground shadow-sm transition-[border-color,box-shadow] duration-100",
        !selected && "hover:border-foreground/20 hover:shadow-md",
        isContextMenuOpen && "border-foreground/20",
      )}
      style={
        canvas
          ? { width: "100%", height: "100%" }
          : {
              width: "100%",
              aspectRatio: `${asset.frameWidth} / ${asset.frameHeight}`,
            }
      }
      role="group"
      aria-label={`Diagram${asset.title ? `: ${asset.title}` : ""}`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        edit();
      }}
    >
      {svg ? (
        <div
          className="diagram-svg pointer-events-none flex size-full items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <span className="text-xs text-muted-foreground">
          {error ?? "Rendering diagram…"}
        </span>
      )}
      <button
        type="button"
        className="nodrag absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-foreground opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          edit();
        }}
        aria-label="Edit diagram"
      >
        <PencilIcon className="size-3" /> Edit
      </button>
    </div>
  );
}
