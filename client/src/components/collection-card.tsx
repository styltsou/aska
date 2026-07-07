import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FolderIcon } from "lucide-react";
import type { CollectionSummary } from "@/data/collections";

interface CollectionCardProps {
  collection: CollectionSummary;
  workspaceSlug: string;
}

export function CollectionCard({
  collection,
  workspaceSlug,
}: CollectionCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to="/$workspaceSlug/collections/$"
      params={{ workspaceSlug, _splat: collection.slug }}
      className="relative cursor-pointer overflow-hidden rounded-lg border bg-sidebar transition-all duration-200 ease-out hover:border-sidebar-foreground/20"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative flex aspect-3/2 items-center justify-center overflow-hidden bg-sidebar/50">
        {collection.previews.map((url, i) => {
          const deg = (i - 1.5) * 4;
          const hovDeg = (i - 1.5) * 16;
          const x = (i - 1.5) * 4;
          const y = i * 5;
          const hoverX = (i - 1.5) * 12;
          const hoverY = Math.abs(i - 1.5) * 3 - 3;

          return (
            <img
              key={i}
              src={url}
              alt=""
              className="absolute rounded-xl object-cover shadow-md ring-1 ring-sidebar-foreground/5"
              style={{
                zIndex: i,
                width: "60%",
                height: "60%",
                top: "50%",
                left: "50%",
                translate: hovered
                  ? `calc(-50% + ${hoverX}px) calc(-50% + ${hoverY}px)`
                  : `calc(-50% + ${x}px) calc(-50% + ${y}px)`,
                transform: `rotate(${hovered ? hovDeg : deg}deg) scale(${hovered ? 1.035 : 1})`,
                transformOrigin: "bottom center",
                transitionDelay: hovered ? `${i * 18}ms` : `${(3 - i) * 10}ms`,
                transition:
                  "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), translate 240ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform, translate",
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 bg-sidebar/60 px-3 py-2.5 backdrop-blur-sm">
        <FolderIcon className="size-4 shrink-0 text-sidebar-foreground" />
        <span className="truncate text-sm font-medium">
          {collection.name}
        </span>
        <span className="ml-auto text-xs text-sidebar-foreground/40">
          {collection.count}
        </span>
      </div>
    </Link>
  );
}
