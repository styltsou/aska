import { useEffect, useState } from "react";
import { ChevronRightIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";

import { useNoteBacklinks, useNoteBacklinkSummary } from "@/api/note-mentions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function NoteBacklinks({
  workspaceSlug,
  assetId,
  onOpen,
}: {
  workspaceSlug: string;
  assetId: string | undefined;
  onOpen: (assetId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [openingAssetId, setOpeningAssetId] = useState<string>();
  const summary = useNoteBacklinkSummary(workspaceSlug, assetId);
  const backlinks = useNoteBacklinks(workspaceSlug, assetId, open);

  useEffect(() => {
    setOpen(false);
    setOpeningAssetId(undefined);
  }, [assetId]);

  const count = summary.data?.count ?? 0;
  if (!assetId || count === 0) return null;

  async function openBacklink(backlinkAssetId: string) {
    if (openingAssetId) return;
    setOpeningAssetId(backlinkAssetId);
    try {
      await onOpen(backlinkAssetId);
    } finally {
      setOpeningAssetId(undefined);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none">
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150",
            open && "rotate-90",
          )}
        />
        <span>Referenced by {count}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/25">
          {backlinks.isPending ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
              <LoaderCircleIcon className="size-3.5 animate-spin" />
              <span>Loading references…</span>
            </div>
          ) : backlinks.isError ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              Could not load references.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {backlinks.data?.backlinks.map((backlink) => {
                const isOpening = openingAssetId === backlink.assetId;
                return (
                  <button
                    key={backlink.assetId}
                    type="button"
                    disabled={Boolean(openingAssetId)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/70 disabled:cursor-wait"
                    onClick={() => void openBacklink(backlink.assetId)}
                  >
                    {isOpening ? (
                      <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {backlink.title}
                    </span>
                    <span className="max-w-40 truncate pl-4 text-xs text-muted-foreground">
                      {backlink.locationLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
