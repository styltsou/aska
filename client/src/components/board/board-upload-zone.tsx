import React, { useState } from "react";
import { ImagePlusIcon, LoaderCircleIcon } from "lucide-react";
import { SUPPORTED_IMAGE_MIME_TYPE_SET } from "@/constants";
import { cn, parseHttpUrl } from "@/lib/utils";
import { useBoardAssetActions } from "./use-board-asset-actions";

export function BoardUploadZone({
  workspaceSlug,
  collectionPath,
  target = "collection",
  children,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: "collection" | "inbox";
  children: React.ReactNode;
}) {
  const {
    createTextNote,
    importRemoteUrl,
    isPending,
    statusText,
    uploadFiles,
  } = useBoardAssetActions({
    workspaceSlug,
    collectionPath,
    target,
  });
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFile(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingImage(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingImage(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFile(event.dataTransfer)) return;
    event.preventDefault();
    setIsDraggingImage(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files);
    const imageFiles = files.filter((file) =>
      SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type),
    );
    if (imageFiles.length > 0) {
      event.preventDefault();
      void uploadFiles(files);
      return;
    }

    const text = event.clipboardData.getData("text/plain").trim();
    const url = parseHttpUrl(text);
    if (url) {
      event.preventDefault();
      void importRemoteUrl(url);
      return;
    }

    if (text) {
      event.preventDefault();
      void createTextNote(text);
    }
  }

  return (
    <div
      className="relative min-h-[calc(100vh-5rem)] outline-none"
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {children}
      <div
        className={cn(
          "border-primary/50 bg-background/70 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border border-dashed opacity-0 backdrop-blur-sm transition-opacity",
          isDraggingImage && "opacity-100",
        )}
      >
        <div className="flex items-center gap-2 rounded-lg bg-popover px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-border">
          <ImagePlusIcon className="size-4" />
          <span>Drop images to upload</span>
        </div>
      </div>
      {statusText ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-lg bg-popover px-3 py-2 text-sm font-medium shadow-lg ring-1 ring-border">
          <LoaderCircleIcon className="size-4 animate-spin" />
          <span>{statusText}</span>
        </div>
      ) : null}
      {isPending ? (
        <span className="sr-only" aria-live="polite">
          {statusText}
        </span>
      ) : null}
    </div>
  );
}

function hasImageFile(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.items).some(
    (item) =>
      item.kind === "file" && SUPPORTED_IMAGE_MIME_TYPE_SET.has(item.type),
  );
}
