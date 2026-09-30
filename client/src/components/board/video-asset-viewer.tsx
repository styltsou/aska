import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { VideoAsset } from "@/types/asset";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiPatch, apiUrl } from "@/lib/api";

export function VideoAssetViewer({
  workspaceSlug,
  asset,
  open,
  onClose,
  onCloseComplete,
}: {
  workspaceSlug: string;
  asset?: VideoAsset;
  open: boolean;
  onClose: () => void;
  onCloseComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(asset?.note ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setNote(asset?.note ?? ""), [asset?.id, asset?.note]);
  useEffect(() => {
    if (!open) onCloseComplete();
  }, [open, onCloseComplete]);
  const ready = asset?.processingStatus === "completed" && !!asset.url;
  const save = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      await apiPatch(
        `/api/v1/workspace/${encodeURIComponent(workspaceSlug)}/assets/${encodeURIComponent(asset.id)}/video`,
        {
          note: note.trim() || null,
        },
      );
      void queryClient.invalidateQueries({
        queryKey: ["workspace-asset", workspaceSlug, asset.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["collectionContents", workspaceSlug],
      });
      void queryClient.invalidateQueries({
        queryKey: ["inboxContents", workspaceSlug],
      });
      toast.success("Video note saved");
    } catch {
      toast.error("Could not save video note");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogBody className="space-y-4">
          <DialogHeader>
            <DialogTitle>{asset?.title ?? "Video"}</DialogTitle>
            <DialogDescription>
              {asset?.sourceLabel
                ? `Imported from ${asset.sourceLabel}`
                : "Video asset"}
            </DialogDescription>
          </DialogHeader>
          {ready ? (
            <video
              key={asset.id}
              src={asset.url!}
              poster={asset.posterUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="max-h-[60vh] w-full rounded-lg bg-black"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm">
              {asset?.processingStatus === "failed"
                ? (asset.processingError ?? "Video processing failed")
                : "Processing video…"}
            </div>
          )}
          {asset ? (
            <div className="text-xs text-muted-foreground">
              {asset.width && asset.height
                ? `${asset.width} × ${asset.height}`
                : null}
              {asset.durationSeconds
                ? ` · ${Math.round(asset.durationSeconds)} seconds`
                : null}
            </div>
          ) : null}
          <Textarea
            aria-label="Video note"
            placeholder="Add a note"
            value={note}
            maxLength={10_000}
            onChange={(event) => setNote(event.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          {ready ? (
            <a
              href={apiUrl(
                `/api/v1/workspace/${encodeURIComponent(workspaceSlug)}/assets/${encodeURIComponent(asset.id)}/download`,
              )}
              className="text-sm underline"
            >
              Download original
            </a>
          ) : (
            <span />
          )}
          <Button
            type="button"
            disabled={saving || !asset}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
