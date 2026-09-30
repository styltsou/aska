import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CloudIcon,
  ClapperboardIcon,
  ImagePlusIcon,
  LinkIcon,
  MonitorUpIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  useCreateInboxRemoteImage,
  useCreateRemoteImage,
  useUploadInboxImages,
  useUploadLocalImages,
} from "@/api/collection";
import { collectionQueryKeys } from "@/api/collection/query-keys";
import type {
  BoardInsertionPlacement,
  CollectionContentsResponse,
  CollectionNode,
} from "@/api/collection";
import { resolveMediaUrl, type ResolvedMediaUrl } from "@/api/media";
import { useVideoAssets } from "@/api/video";
import { Button } from "@/components/ui/button";
import { SUPPORTED_MEDIA_ACCEPT } from "@/constants";
import { reserveNodePositions } from "@/components/canvas/canvas-node-layout";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  clearUploadImagesDraft,
  getUploadImagesDraftId,
  loadUploadImagesDraft,
  saveUploadImagesDraft,
} from "@/lib/upload-images-draft";
import {
  isUploadableMediaFile,
  localMediaKind,
  reserveLocalMediaPositions,
} from "@/lib/media-upload";
import { cn, parseHttpUrl } from "@/lib/utils";

type RemoteResolution =
  | { status: "ready"; media: ResolvedMediaUrl }
  | { status: "error"; message: string };

export function UploadMediaDialog({
  workspaceSlug,
  collectionPath,
  target = "collection",
  children,
  open: controlledOpen,
  onOpenChange,
  restoreOpen = false,
  placement,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: "collection" | "inbox";
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  restoreOpen?: boolean;
  placement?: BoardInsertionPlacement;
}) {
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const queryClient = useQueryClient();
  const uploadLocalImages = useUploadLocalImages(workspaceSlug, collectionSlug);
  const uploadInboxImages = useUploadInboxImages(workspaceSlug);
  const createRemoteImage = useCreateRemoteImage(workspaceSlug, collectionSlug);
  const createInboxRemoteImage = useCreateInboxRemoteImage(workspaceSlug);
  const videos = useVideoAssets({
    workspaceSlug,
    collectionSlug: target === "collection" ? collectionSlug : undefined,
    parentFolderPath: target === "collection" ? parentFolderPath : undefined,
  });
  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<"local" | "remote" | "cloud">("local");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteUrls, setRemoteUrls] = useState<string[]>([]);
  const [remoteResolutions, setRemoteResolutions] = useState<
    Record<string, RemoteResolution>
  >({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isRestoringDraft, setIsRestoringDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const remoteUrlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previousSelectedFileCount = useRef(0);
  const isHydratingDraftRef = useRef(false);
  const restoreVersionRef = useRef(0);
  const resolutionVersionRef = useRef(0);
  const resolvingUrlsRef = useRef(new Set<string>());
  const open = controlledOpen ?? internalOpen;
  const isSubmitting =
    uploadLocalImages.isPending ||
    uploadInboxImages.isPending ||
    createRemoteImage.isPending ||
    createInboxRemoteImage.isPending ||
    videos.upload.isPending ||
    videos.importUrl.isPending;
  const isInteractionDisabled = isSubmitting || isRestoringDraft;
  const draftScope = `${workspaceSlug}\u0000${target}\u0000${collectionPath}`;
  const draftId = useMemo(
    () =>
      getUploadImagesDraftId(
        workspaceSlug,
        target === "collection" ? collectionPath : `inbox:${collectionPath}`,
      ),
    [workspaceSlug, target, collectionPath],
  );
  const previousDraftScopeRef = useRef(draftScope);
  const previousDraftIdRef = useRef(draftId);
  const initialDraftScopeRef = useRef(draftScope);
  const isInitialPageReloadRef = useRef(isPageReload());
  // The header owns refresh recovery so other dialog entry points cannot compete.
  const shouldRestoreOpen =
    restoreOpen &&
    isInitialPageReloadRef.current &&
    initialDraftScopeRef.current === draftScope;
  const shouldRestoreDraft = open || shouldRestoreOpen;

  useEffect(() => {
    const nextPreviewUrls = selectedFiles.map((file) =>
      URL.createObjectURL(file),
    );
    setPreviewUrls(nextPreviewUrls);

    return () => {
      nextPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  useEffect(() => {
    if (!open) return;
    const version = resolutionVersionRef.current;
    for (const url of remoteUrls) {
      if (remoteResolutions[url] || resolvingUrlsRef.current.has(url)) continue;
      resolvingUrlsRef.current.add(url);
      void resolveMediaUrl(workspaceSlug, url)
        .then((media) => {
          if (resolutionVersionRef.current !== version) return;
          setRemoteResolutions((current) => ({
            ...current,
            [url]: { status: "ready", media },
          }));
        })
        .catch((cause) => {
          if (resolutionVersionRef.current !== version) return;
          setRemoteResolutions((current) => ({
            ...current,
            [url]: {
              status: "error",
              message:
                cause instanceof Error
                  ? cause.message
                  : "Could not identify this media URL",
            },
          }));
        })
        .finally(() => {
          if (resolutionVersionRef.current === version) {
            resolvingUrlsRef.current.delete(url);
          }
        });
    }
  }, [open, remoteResolutions, remoteUrls, workspaceSlug]);

  useLayoutEffect(() => {
    const textarea = remoteUrlTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [remoteUrl]);

  useLayoutEffect(() => {
    if (!shouldRestoreDraft || !draftId) {
      isHydratingDraftRef.current = false;
      setIsRestoringDraft(false);
      return;
    }

    let cancelled = false;
    const restoreVersion = ++restoreVersionRef.current;
    isHydratingDraftRef.current = true;
    setIsRestoringDraft(true);

    void loadUploadImagesDraft(draftId)
      .then((draft) => {
        if (
          cancelled ||
          restoreVersionRef.current !== restoreVersion ||
          !draft
        ) {
          return;
        }
        setMode(draft.mode);
        setRemoteUrl(draft.remoteUrl);
        setRemoteUrls(draft.remoteUrls);
        setSelectedFiles(draft.files);
        if (draft.open && shouldRestoreOpen && controlledOpen === undefined) {
          setInternalOpen(true);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled && restoreVersionRef.current === restoreVersion) {
          isHydratingDraftRef.current = false;
          setIsRestoringDraft(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [controlledOpen, draftId, shouldRestoreDraft, shouldRestoreOpen]);

  useLayoutEffect(() => {
    if (previousDraftScopeRef.current === draftScope) return;
    const previousDraftId = previousDraftIdRef.current;
    previousDraftScopeRef.current = draftScope;
    previousDraftIdRef.current = draftId;

    if (!open) return;

    // History navigation changes the destination, but must not discard its scoped draft.
    if (
      previousDraftId &&
      (selectedFiles.length > 0 ||
        remoteUrls.length > 0 ||
        remoteUrl.trim().length > 0)
    ) {
      void saveUploadImagesDraft(previousDraftId, {
        files: selectedFiles,
        mode: getDraftMode(mode, selectedFiles, remoteUrls, remoteUrl),
        open: false,
        remoteUrl,
        remoteUrls,
      }).catch(() => undefined);
    }
    setMode("local");
    setRemoteUrl("");
    setRemoteUrls([]);
    setRemoteResolutions({});
    resolutionVersionRef.current += 1;
    resolvingUrlsRef.current.clear();
    setSelectedFiles([]);
    setError(null);
    onOpenChange?.(false);
    if (controlledOpen === undefined) setInternalOpen(false);
  }, [
    controlledOpen,
    draftId,
    draftScope,
    mode,
    onOpenChange,
    open,
    remoteUrl,
    remoteUrls,
    selectedFiles,
  ]);

  useEffect(() => {
    if (!open || !draftId || isRestoringDraft || isHydratingDraftRef.current) {
      return;
    }

    const hasDraftContent =
      selectedFiles.length > 0 ||
      remoteUrls.length > 0 ||
      remoteUrl.trim().length > 0;
    if (!hasDraftContent) {
      void clearUploadImagesDraft(draftId).catch(() => undefined);
      return;
    }

    void saveUploadImagesDraft(draftId, {
      files: selectedFiles,
      mode: getDraftMode(mode, selectedFiles, remoteUrls, remoteUrl),
      open: true,
      remoteUrl,
      remoteUrls,
    }).catch(() => undefined);
  }, [
    draftId,
    isRestoringDraft,
    mode,
    open,
    remoteUrl,
    remoteUrls,
    selectedFiles,
  ]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      restoreVersionRef.current += 1;
      isHydratingDraftRef.current = false;
      setIsRestoringDraft(false);
      setRemoteUrl("");
      setRemoteUrls([]);
      setRemoteResolutions({});
      resolutionVersionRef.current += 1;
      resolvingUrlsRef.current.clear();
      setSelectedFiles([]);
      setIsDraggingFiles(false);
      setError(null);
      // More has no draftable source yet. Revisit this when provider imports can resume.
      setMode("local");
      uploadLocalImages.reset();
      uploadInboxImages.reset();
      createRemoteImage.reset();
      createInboxRemoteImage.reset();
      videos.upload.reset();
      videos.importUrl.reset();
      if (draftId) {
        void clearUploadImagesDraft(draftId).catch(() => undefined);
      }
    }
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
  }

  function addFiles(files: File[]) {
    setError(null);
    const validFiles = files.filter(isUploadableMediaFile);
    if (validFiles.length !== files.length) {
      setError(
        "Some files were skipped. Use JPEG, PNG, WebP, or GIF images up to 20 MB, or MP4 and WebM videos up to 250 MB.",
      );
    }
    if (validFiles.length > 0) {
      setSelectedFiles((currentFiles) => [...currentFiles, ...validFiles]);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function removeFile(index: number) {
    setError(null);
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function selectMode(nextMode: "local" | "remote" | "cloud") {
    setError(null);
    setMode(nextMode);
  }

  function parseRemoteUrls(value: string) {
    const urls: string[] = [];
    let hasInvalidUrl = false;

    for (const candidate of value.split(/\s+/)) {
      if (!candidate) continue;
      const url = parseHttpUrl(candidate);
      if (!url) {
        hasInvalidUrl = true;
        continue;
      }
      if (!urls.includes(url)) urls.push(url);
    }

    return { hasInvalidUrl, urls };
  }

  function addRemoteUrls(value: string) {
    const { hasInvalidUrl, urls } = parseRemoteUrls(value);
    if (hasInvalidUrl) {
      setError("Use complete http or https media URLs.");
    } else if (urls.length > 0) {
      setError(null);
    }
    if (urls.length === 0) return;

    setRemoteUrls((currentUrls) => [
      ...currentUrls,
      ...urls.filter((url) => !currentUrls.includes(url)),
    ]);
    setRemoteUrl("");
  }

  function handleRemoteUrlChange(
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) {
    setError(null);
    const value = event.target.value;
    const values = value.split(/\s+/);

    if (values.length === 1) {
      setRemoteUrl(value);
      return;
    }

    addRemoteUrls(values.slice(0, -1).join(" "));
    setRemoteUrl(values.at(-1) ?? "");
  }

  function handleRemoteUrlKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      return;
    }

    if (event.key === " " && remoteUrl.trim()) {
      event.preventDefault();
      addRemoteUrls(remoteUrl);
      return;
    }

    if (event.key === "Backspace" && !remoteUrl && remoteUrls.length > 0) {
      setError(null);
      setRemoteUrls((currentUrls) => currentUrls.slice(0, -1));
    }
  }

  function removeRemoteUrl(url: string) {
    setError(null);
    setRemoteUrls((currentUrls) =>
      currentUrls.filter((currentUrl) => currentUrl !== url),
    );
    setRemoteResolutions((current) => {
      const next = { ...current };
      delete next[url];
      return next;
    });
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (isInteractionDisabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFiles(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
    if (!isInteractionDisabled) addFiles(Array.from(event.dataTransfer.files));
  }

  async function reserveLocalPositions(files: File[]) {
    if (target === "inbox") return [];
    const existing = queryClient.getQueryData<CollectionContentsResponse>(
      collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        parentFolderPath,
      ),
    );
    return reserveLocalMediaPositions(files, existing?.nodes ?? [], placement);
  }

  async function uploadLocalMedia(files: File[]) {
    const positions = await reserveLocalPositions(files);
    const images = files.flatMap((file, index) =>
      localMediaKind(file) === "image"
        ? [{ file, position: positions[index] }]
        : [],
    );
    const videoFiles = files.flatMap((file, index) =>
      localMediaKind(file) === "video"
        ? [{ file, position: positions[index] }]
        : [],
    );
    if (images.length > 0) {
      const imageGroups =
        videoFiles.length > 0 ? images.map((image) => [image]) : [images];
      for (const group of imageGroups) {
        try {
          if (target === "inbox") {
            await uploadInboxImages.mutateAsync({
              files: group.map(({ file }) => file),
            });
          } else {
            await uploadLocalImages.mutateAsync({
              files: group.map(({ file }) => file),
              parentFolderPath,
              placement,
              positions: group.map(({ position }) => position!),
            });
          }
        } catch {
          // The image upload mutation reports its failure; continue the mixed batch.
        }
      }
    }
    const results = await Promise.allSettled(
      videoFiles.map(({ file, position }) =>
        videos.upload.mutateAsync({ file, position }),
      ),
    );
    reportMediaFailures(results, "video", "uploaded");
  }

  async function importRemoteMedia(urls: string[]) {
    const entries = urls.map((url) => {
      const resolution = remoteResolutions[url];
      if (resolution?.status !== "ready")
        throw new Error("A media URL has not been identified");
      return { url, kind: resolution.media.kind };
    });
    const existing =
      target === "collection"
        ? queryClient.getQueryData<CollectionContentsResponse>(
            collectionQueryKeys.contents(
              workspaceSlug,
              collectionSlug,
              parentFolderPath,
            ),
          )
        : undefined;
    const nodes = entries.map(({ kind }, index) => ({
      id: `pending-media-url-${index}`,
      type: kind,
      width: kind === "video" ? 16 : 1,
      height: kind === "video" ? 9 : 1,
    })) as CollectionNode[];
    const positions =
      target === "collection"
        ? reserveNodePositions(existing?.nodes ?? [], nodes, placement)
        : [];
    const results = await Promise.allSettled(
      entries.map(({ url, kind }, index) => {
        if (kind === "video") {
          return videos.importUrl.mutateAsync({
            url,
            position: positions[index],
          });
        }
        if (target === "inbox")
          return createInboxRemoteImage.mutateAsync({ url });
        return createRemoteImage.mutateAsync({
          url,
          parentFolderPath,
          placement: positions[index]
            ? { position: positions[index] }
            : placement,
        });
      }),
    );
    reportMediaFailures(results, "media URL", "imported");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      if (mode === "local") {
        if (selectedFiles.length === 0) {
          setError("Choose at least one image or video.");
          return;
        }
        void uploadLocalMedia(selectedFiles).catch((cause) =>
          toast.error(
            cause instanceof Error
              ? cause.message
              : "Media could not be uploaded",
          ),
        );
        handleOpenChange(false);
        return;
      } else if (mode === "remote") {
        const parsedUrls = parseRemoteUrls(remoteUrl);
        if (parsedUrls.hasInvalidUrl) {
          setError("Use complete http or https media URLs.");
          return;
        }
        const urls = [
          ...remoteUrls,
          ...parsedUrls.urls.filter((url) => !remoteUrls.includes(url)),
        ];
        if (urls.length === 0) {
          setError("Enter at least one image or video URL.");
          return;
        }
        if (urls.some((url) => remoteResolutions[url]?.status !== "ready")) {
          setRemoteUrls(urls);
          setRemoteUrl("");
          return;
        }
        void importRemoteMedia(urls).catch((cause) =>
          toast.error(
            cause instanceof Error
              ? cause.message
              : "Media could not be imported",
          ),
        );
        handleOpenChange(false);
        return;
      } else {
        setError("Cloud uploads are not available yet.");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload media.");
    }
  }

  const shouldScrollPreviews = selectedFiles.length >= 8;
  const unresolvedRemoteUrls = remoteUrls.some(
    (url) => remoteResolutions[url]?.status !== "ready",
  );
  const textareaSpansUrlGrid = remoteUrls.length % 2 === 0;
  const textareaSharesUrlRow = !textareaSpansUrlGrid;

  useLayoutEffect(() => {
    const isAddingFiles =
      selectedFiles.length > previousSelectedFileCount.current;
    previousSelectedFileCount.current = selectedFiles.length;

    if (!isAddingFiles || !shouldScrollPreviews) return;
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [selectedFiles.length, shouldScrollPreviews]);

  const previewGrid = (
    <div className="grid grid-cols-3 gap-3 p-0.5 sm:grid-cols-4">
      {selectedFiles.map((file, index) => (
        <div
          key={`${file.name}-${file.lastModified}-${index}`}
          className="group relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted shadow-sm"
        >
          {localMediaKind(file) === "video" ? (
            <>
              <video
                aria-label={file.name}
                className="size-full object-cover"
                muted
                playsInline
                preload="metadata"
                src={previewUrls[index]}
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 text-white">
                <PlayIcon className="size-7 fill-current" />
              </span>
              <span className="pointer-events-none absolute right-1.5 bottom-1.5 left-1.5 truncate rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                {file.name}
              </span>
            </>
          ) : (
            <img
              alt={file.name}
              className="size-full object-cover"
              src={previewUrls[index]}
            />
          )}
          <Button
            aria-label={`Remove ${file.name}`}
            className="absolute top-1.5 right-1.5 bg-background/70 text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-md transition-colors duration-[50ms] hover:bg-background"
            disabled={isInteractionDisabled}
            size="icon-xs"
            type="button"
            variant="ghost"
            onClick={() => removeFile(index)}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <button
        aria-label="Add more images or videos"
        className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border/80 bg-background/45 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        disabled={isInteractionDisabled}
        type="button"
        onClick={() => fileInputRef.current?.click()}
      >
        <ImagePlusIcon className="size-5" />
      </button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger render={children} /> : null}
      <DialogContent
        className="max-w-2xl"
        initialFocus={mode === "remote" ? remoteUrlTextareaRef : false}
      >
        <form onSubmit={handleSubmit}>
          <AnimatedDialogPanel>
            <DialogBody className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Upload images and videos</DialogTitle>
                <DialogDescription>
                  Add images and videos from this computer or from a URL.
                </DialogDescription>
              </DialogHeader>

              <Tabs
                value={mode}
                onValueChange={(nextMode) =>
                  selectMode(nextMode as "local" | "remote" | "cloud")
                }
              >
                <TabsList
                  aria-label="Media source"
                  className="grid w-full grid-cols-3"
                >
                  <TabsTrigger
                    value="local"
                    disabled={isInteractionDisabled}
                    className="h-8 px-4"
                  >
                    <MonitorUpIcon />
                    Computer
                  </TabsTrigger>
                  <TabsTrigger
                    value="remote"
                    disabled={isInteractionDisabled}
                    className="h-8 px-4"
                  >
                    <LinkIcon />
                    URL
                  </TabsTrigger>
                  <TabsTrigger
                    value="cloud"
                    disabled={isInteractionDisabled}
                    className="h-8 px-4"
                  >
                    <CloudIcon />
                    More
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === "local" ? (
                <div className="space-y-1.5">
                  {selectedFiles.length > 0 ? (
                    <p className="text-right text-xs text-muted-foreground">
                      {selectedFiles.length} file
                      {selectedFiles.length === 1 ? "" : "s"} selected
                    </p>
                  ) : null}
                  <div
                    className="rounded-lg border border-dashed border-border/80 bg-background/35 p-3 transition-colors data-[dragging=true]:border-primary/60 data-[dragging=true]:bg-primary/5"
                    data-dragging={isDraggingFiles || undefined}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      className="sr-only"
                      type="file"
                      accept={SUPPORTED_MEDIA_ACCEPT}
                      multiple
                      disabled={isInteractionDisabled}
                      onChange={handleFileChange}
                    />
                    {selectedFiles.length === 0 ? (
                      <button
                        className="flex min-h-56 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md px-4 text-center transition-colors outline-none hover:bg-muted/45 focus-visible:bg-muted/45 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                        disabled={isInteractionDisabled}
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <span className="flex size-10 items-center justify-center rounded-lg border border-border/70 bg-background/65 text-muted-foreground shadow-sm backdrop-blur-sm">
                          <ClapperboardIcon className="size-4" />
                        </span>
                        <span className="space-y-1">
                          <span className="block text-sm font-medium text-foreground">
                            Drop images or videos here, or browse
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Select JPEG, PNG, WebP, or GIF images and MP4 or
                            WebM videos
                          </span>
                        </span>
                      </button>
                    ) : shouldScrollPreviews ? (
                      <ScrollArea
                        className="-mr-3 h-80 pr-3 sm:h-[22.5rem]"
                        viewportRef={previewViewportRef}
                      >
                        {previewGrid}
                      </ScrollArea>
                    ) : (
                      previewGrid
                    )}
                  </div>
                </div>
              ) : mode === "remote" ? (
                <div className="space-y-1.5">
                  <div className="rounded-md border border-input bg-muted p-1.5 shadow-[0_1px_1px_rgb(0_0_0_/_0.02)] ring-1 ring-foreground/[0.025] backdrop-blur-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    <div className="grid grid-cols-2 items-start gap-1.5">
                      {remoteUrls.map((url) => (
                        <span
                          key={url}
                          className="flex min-w-0 items-center gap-1 rounded-sm border border-border/70 bg-background/85 pr-0 pl-1.5 text-xs text-foreground shadow-[0_1px_1px_rgb(0_0_0_/_0.025)]"
                        >
                          <span className="shrink-0 text-muted-foreground">
                            {remoteResolutions[url]?.status === "ready"
                              ? remoteResolutions[url].media.kind === "video"
                                ? "Video"
                                : "Image"
                              : remoteResolutions[url]?.status === "error"
                                ? "Unsupported"
                                : "Checking…"}
                          </span>
                          <span className="min-w-0 flex-1 truncate" title={url}>
                            {url}
                          </span>
                          <Button
                            aria-label={`Remove ${url}`}
                            className="ml-auto shrink-0 text-muted-foreground transition-colors duration-75"
                            disabled={isInteractionDisabled}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                            onClick={() => removeRemoteUrl(url)}
                          >
                            <XIcon />
                          </Button>
                        </span>
                      ))}
                      <Textarea
                        ref={remoteUrlTextareaRef}
                        aria-label="Image or video URLs"
                        id="remote-media-url"
                        className={cn(
                          "min-h-16 min-w-0 resize-none overflow-hidden border-0 bg-transparent px-1 py-0 text-sm leading-5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
                          textareaSpansUrlGrid && "col-span-2",
                          textareaSharesUrlRow && "pt-1.5",
                        )}
                        disabled={isInteractionDisabled}
                        inputMode="url"
                        placeholder={
                          remoteUrls.length > 0
                            ? "Add another URL"
                            : "https://example.com/media"
                        }
                        rows={3}
                        value={remoteUrl}
                        onBlur={() => addRemoteUrls(remoteUrl)}
                        onChange={handleRemoteUrlChange}
                        onKeyDown={handleRemoteUrlKeyDown}
                        onPaste={(event) => {
                          const value = event.clipboardData.getData("text");
                          if (!value.trim()) return;
                          event.preventDefault();
                          addRemoteUrls(value);
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Separate URLs with a space. Direct image and video links are
                    identified automatically.
                  </p>
                  {remoteUrls.map((url) =>
                    remoteResolutions[url]?.status === "error" ? (
                      <p key={url} className="text-xs text-destructive">
                        {url}: {remoteResolutions[url].message}
                      </p>
                    ) : null,
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    className="h-auto min-h-20 justify-start gap-3 border-border/60 bg-background/35 px-3 py-2.5 text-left shadow-sm backdrop-blur-sm"
                    disabled
                    type="button"
                    variant="outline"
                  >
                    <GoogleDriveIcon className="size-8 shrink-0" />
                    <span className="flex flex-col items-start gap-0.5">
                      <span>Google Drive</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Coming soon
                      </span>
                    </span>
                  </Button>
                  <Button
                    className="h-auto min-h-20 justify-start gap-3 border-border/60 bg-background/35 px-3 py-2.5 text-left shadow-sm backdrop-blur-sm"
                    disabled
                    type="button"
                    variant="outline"
                  >
                    <DropboxIcon className="size-8 shrink-0 text-[#0061FF]" />
                    <span className="flex flex-col items-start gap-0.5">
                      <span>Dropbox</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Coming soon
                      </span>
                    </span>
                  </Button>
                  <Button
                    className="h-auto min-h-20 justify-start gap-3 border-border/60 bg-background/35 px-3 py-2.5 text-left shadow-sm backdrop-blur-sm"
                    disabled
                    type="button"
                    variant="outline"
                  >
                    <OneDriveIcon className="size-10 shrink-0" />
                    <span className="flex flex-col items-start gap-0.5">
                      <span>OneDrive</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Coming soon
                      </span>
                    </span>
                  </Button>
                </div>
              )}

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </DialogBody>
          </AnimatedDialogPanel>
          <DialogFooter className="shrink-0">
            <DialogClose
              render={<Button disabled={isSubmitting} variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              disabled={
                isInteractionDisabled ||
                mode === "cloud" ||
                (mode === "remote" && unresolvedRemoteUrls)
              }
              type="submit"
            >
              {isSubmitting ? "Uploading" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnimatedDialogPanel({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const updateHeight = () => setHeight(content.offsetHeight);
    updateHeight();

    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={height === undefined ? undefined : { height }}
      className="overflow-hidden will-change-[height]"
      initial={false}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
}

function getDraftMode(
  mode: "local" | "remote" | "cloud",
  files: File[],
  remoteUrls: string[],
  remoteUrl: string,
): "local" | "remote" {
  const hasLocalDraft = files.length > 0;
  const hasRemoteDraft = remoteUrls.length > 0 || remoteUrl.trim().length > 0;

  if (mode === "remote" && hasRemoteDraft) return "remote";
  if (mode === "local" && hasLocalDraft) return "local";

  return hasLocalDraft ? "local" : "remote";
}

function reportMediaFailures(
  results: PromiseSettledResult<unknown>[],
  label: string,
  action: string,
) {
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length === 0) return;
  const cause = failures[0]?.reason;
  toast.error(
    failures.length === 1 && cause instanceof Error
      ? cause.message
      : `${failures.length} ${label}${failures.length === 1 ? "" : "s"} could not be ${action}.`,
  );
}

function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 88 78">
      <path
        d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 000 53h27.5z"
        fill="#00ac47"
      />
      <path
        d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H59.798l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}

function DropboxIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 236 200">
      <path d="M58.86 75l58.87-37.5L58.86 0 0 37.5z" fill="#0061ff" />
      <path d="M176.59 75l58.86-37.5L176.59 0l-58.86 37.5z" fill="#0061ff" />
      <path d="M117.73 112.5L58.86 75 0 112.5 58.86 150z" fill="#0061ff" />
      <path d="M176.59 150l58.86-37.5L176.59 75l-58.86 37.5z" fill="#0061ff" />
      <path
        d="M176.59 162.5L117.73 125l-58.87 37.5 58.87 37.5z"
        fill="#0061ff"
      />
    </svg>
  );
}

function OneDriveIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="-154.5063 -164.9805 1339.0546 989.883"
    >
      <path
        d="M622.292 445.338l212.613-203.327C790.741 69.804 615.338-33.996 443.13 10.168a321.9 321.9 0 00-188.92 134.837c3.29-.083 368.082 300.333 368.082 300.333z"
        fill="#0364B8"
      />
      <path
        d="M392.776 183.283l-.01.035A256.233 256.233 0 00257.5 144.921c-1.104 0-2.189.07-3.29.083C112.063 146.765-1.74 263.424.02 405.567a257.389 257.389 0 0046.244 144.04l318.528-39.894 244.21-196.915z"
        fill="#0078D4"
      />
      <path
        d="M834.905 242.012c-4.674-.312-9.37-.528-14.123-.528a208.464 208.464 0 00-82.93 17.117l-.006-.022-128.844 54.22 142.041 175.456 253.934 61.728c54.8-101.732 16.752-228.625-84.98-283.424a209.23 209.23 0 00-85.09-24.546z"
        fill="#1490DF"
      />
      <path
        d="M46.264 549.607C94.36 618.757 173.27 659.967 257.5 659.922h563.281c76.946.022 147.691-42.202 184.195-109.937L609.001 312.798z"
        fill="#28A8EA"
      />
    </svg>
  );
}

function isPageReload(): boolean {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === "reload";
}
