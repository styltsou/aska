import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatNoteMetadataDateTime } from "@/lib/note-date-format";
import { cn } from "@/lib/utils";

/**
 * `assets.createdAt` and `assets.updatedAt` are written by the same insert for
 * a brand new asset, so anything inside this window is the insert itself rather
 * than an edit.
 */
const EDIT_TOLERANCE_MS = 1000;

export function hasAssetBeenEdited(
  createdAt: string | undefined,
  updatedAt: string | undefined,
): boolean {
  if (!updatedAt) return false;
  const editedAt = new Date(updatedAt).getTime();
  if (!Number.isFinite(editedAt)) return false;
  if (!createdAt) return true;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return true;
  return editedAt - created >= EDIT_TOLERANCE_MS;
}

/**
 * Info-icon hover card describing when an asset was created and, only when a
 * person has actually changed it since, when it was last edited.
 */
export function AssetTimestampCard({
  createdAt,
  updatedAt,
  label,
  triggerClassName,
  side = "bottom",
  align = "end",
  sideOffset = 8,
}: {
  createdAt?: string;
  updatedAt?: string;
  label: string;
  triggerClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  const createdLabel = createdAt ? formatNoteMetadataDateTime(createdAt) : "";
  const editedLabel =
    updatedAt && hasAssetBeenEdited(createdAt, updatedAt)
      ? formatNoteMetadataDateTime(updatedAt)
      : "";
  if (!createdLabel && !editedLabel) return null;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-8 shrink-0 rounded-lg", triggerClassName)}
            aria-label={label}
          >
            <InfoIcon className="size-4" />
          </Button>
        }
      />
      <HoverCardContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="w-fit min-w-0 border-border/60 bg-background/95 whitespace-nowrap shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col gap-1 text-xs">
          {createdLabel ? (
            <div>
              <span className="text-muted-foreground">Created at </span>
              <span>{createdLabel}</span>
            </div>
          ) : null}
          {editedLabel ? (
            <div>
              <span className="text-muted-foreground">Edited </span>
              <span>{editedLabel}</span>
            </div>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
