import { useState, type ReactElement } from "react";
import { toast } from "sonner";

import type { BoardInsertionPlacement } from "@/api/collection";
import { useVideoAssets } from "@/api/video";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SUPPORTED_VIDEO_ACCEPT } from "@/constants";
import { parseHttpUrl } from "@/lib/utils";

export function AddVideoDialog({
  workspaceSlug,
  collectionPath,
  target = "collection",
  placement,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: "collection" | "inbox";
  placement?: BoardInsertionPlacement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactElement;
}) {
  const [collectionSlug = "", ...folders] = collectionPath
    .split("/")
    .filter(Boolean);
  const videos = useVideoAssets({
    workspaceSlug,
    collectionSlug: target === "collection" ? collectionSlug : undefined,
    parentFolderPath: folders.join("/") || undefined,
  });
  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = controlledOpen ?? internalOpen;
  const busy = videos.upload.isPending || videos.importUrl.isPending;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
    if (!next) setError(null);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (mode === "file") {
        if (!file) throw new Error("Choose a video file");
        await videos.upload.mutateAsync({
          file,
          position: placement?.position,
        });
      } else {
        const parsed = parseHttpUrl(url);
        if (!parsed) throw new Error("Enter a direct HTTP(S) video URL");
        await videos.importUrl.mutateAsync({
          url: parsed,
          position: placement?.position,
        });
      }
      setOpen(false);
      setFile(null);
      setUrl("");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not add video";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger render={children} /> : null}
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="contents">
          <DialogBody className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add video</DialogTitle>
              <DialogDescription>
                Upload an MP4 or WebM, or import a direct video URL. Maximum 250
                MB.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "file" ? "secondary" : "ghost"}
                onClick={() => setMode("file")}
              >
                Upload file
              </Button>
              <Button
                type="button"
                variant={mode === "url" ? "secondary" : "ghost"}
                onClick={() => setMode("url")}
              >
                From URL
              </Button>
            </div>
            {mode === "file" ? (
              <Input
                aria-label="Video file"
                type="file"
                accept={SUPPORTED_VIDEO_ACCEPT}
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            ) : (
              <Input
                aria-label="Direct video URL"
                type="url"
                placeholder="https://example.com/video.mp4"
                value={url}
                disabled={busy}
                onChange={(event) => setUrl(event.target.value)}
              />
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add video"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
