import React, { useMemo, useState } from "react";
import {
  ImagePlusIcon,
  LinkIcon,
  LoaderCircleIcon,
  UploadIcon,
} from "lucide-react";
import { useCreateRemoteImage, useUploadLocalImages } from "@/api/collection";
import { Button } from "@/components/ui/button";
import {
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_MIME_TYPE_SET,
} from "@/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function UploadImagesDialog({
  workspaceSlug,
  collectionPath,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  workspaceSlug: string;
  collectionPath: string;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const uploadLocalImages = useUploadLocalImages(workspaceSlug, collectionSlug);
  const createRemoteImage = useCreateRemoteImage(workspaceSlug, collectionSlug);
  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<"local" | "remote">("local");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const open = controlledOpen ?? internalOpen;
  const isSubmitting =
    uploadLocalImages.isPending || createRemoteImage.isPending;

  const selectedFileLabel = useMemo(() => {
    if (selectedFiles.length === 0) return "No images selected";
    if (selectedFiles.length === 1)
      return selectedFiles[0]?.name ?? "1 image selected";
    return `${selectedFiles.length} images selected`;
  }, [selectedFiles]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setRemoteUrl("");
      setSelectedFiles([]);
      setError(null);
      uploadLocalImages.reset();
      createRemoteImage.reset();
    }
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(event.target.files ?? []).filter((file) =>
      SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type),
    );
    setSelectedFiles(files);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      if (mode === "local") {
        if (selectedFiles.length === 0) {
          setError("Choose at least one image.");
          return;
        }

        await uploadLocalImages.mutateAsync({
          files: selectedFiles,
          parentFolderPath,
        });
      } else {
        const trimmedUrl = remoteUrl.trim();
        if (!trimmedUrl) {
          setError("Enter an image URL.");
          return;
        }

        await createRemoteImage.mutateAsync({
          url: trimmedUrl,
          parentFolderPath,
        });
      }

      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger render={children} /> : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload images</DialogTitle>
          <DialogDescription>
            Add images from this computer or from a URL.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Button
            type="button"
            variant={mode === "local" ? "secondary" : "ghost"}
            onClick={() => setMode("local")}
          >
            <UploadIcon />
            <span>Computer</span>
          </Button>
          <Button
            type="button"
            variant={mode === "remote" ? "secondary" : "ghost"}
            onClick={() => setMode("remote")}
          >
            <LinkIcon />
            <span>URL</span>
          </Button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "local" ? (
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background text-center transition-colors hover:bg-muted/60">
              <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <ImagePlusIcon className="size-4" />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-medium">
                  {selectedFileLabel}
                </span>
                <span className="block text-xs text-muted-foreground">
                  JPEG, PNG, WebP, or GIF
                </span>
              </span>
              <input
                className="sr-only"
                type="file"
                accept={SUPPORTED_IMAGE_ACCEPT}
                multiple
                disabled={isSubmitting}
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="remote-image-url">
                Image URL
              </label>
              <Input
                id="remote-image-url"
                inputMode="url"
                placeholder="https://example.com/image.jpg"
                value={remoteUrl}
                disabled={isSubmitting}
                onChange={(event) => setRemoteUrl(event.target.value)}
              />
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <UploadIcon />
              )}
              <span>{isSubmitting ? "Uploading" : "Upload"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
