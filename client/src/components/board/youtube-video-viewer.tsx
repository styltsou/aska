import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { useUpdateLink } from "@/api/collection";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { LinkAsset } from "@/types/asset";

type VideoLinkAsset = LinkAsset & { video: NonNullable<LinkAsset["video"]> };

const LINK_NOTE_AUTOSAVE_DELAY_MS = 350;
const LINK_NOTE_STORAGE_KEY = "aska:link-note:v1:";

function linkNoteStorageKey(workspaceSlug: string, assetId: string) {
  return `${LINK_NOTE_STORAGE_KEY}${JSON.stringify([workspaceSlug, assetId])}`;
}

function readLinkNoteDraft(
  workspaceSlug: string,
  assetId: string,
  hasServerNote: boolean,
): string | undefined {
  if (hasServerNote) return undefined;

  try {
    return (
      window.localStorage.getItem(linkNoteStorageKey(workspaceSlug, assetId)) ??
      undefined
    );
  } catch {
    return undefined;
  }
}

function saveLinkNoteDraft(
  workspaceSlug: string,
  assetId: string,
  note: string,
) {
  try {
    window.localStorage.setItem(
      linkNoteStorageKey(workspaceSlug, assetId),
      note,
    );
  } catch {
    // Recovery is best effort when storage is unavailable.
  }
}

function clearLinkNoteDraft(workspaceSlug: string, assetId: string) {
  try {
    window.localStorage.removeItem(linkNoteStorageKey(workspaceSlug, assetId));
  } catch {
    // Recovery cleanup is best effort when storage is unavailable.
  }
}

export function YouTubeVideoViewer({
  asset,
  onClose,
  workspaceSlug,
}: {
  asset?: LinkAsset;
  onClose: () => void;
  workspaceSlug: string;
}) {
  const isMobile = useIsMobile();
  const [activeAsset, setActiveAsset] = useState<VideoLinkAsset>();

  useEffect(() => {
    if (isVideoLinkAsset(asset)) setActiveAsset(asset);
  }, [asset]);

  const displayedAsset = isVideoLinkAsset(asset) ? asset : activeAsset;
  if (!displayedAsset) return null;
  const open = asset !== undefined;
  const accessibleDescription = `Watch ${displayedAsset.title} without leaving Aska.`;

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(next) => !next && onClose()}
        swipeDirection="down"
        showSwipeHandle
        fast
      >
        <DrawerContent
          className="gap-0 overflow-hidden border-border/70 bg-background p-0 text-foreground shadow-2xl"
          style={
            {
              "--drawer-content-max-height":
                "calc(100dvh - var(--app-shell-inset))",
              "--bleed": "0px",
            } as CSSProperties
          }
        >
          <DrawerTitle className="sr-only">{displayedAsset.title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {accessibleDescription}
          </DrawerDescription>
          <VideoViewerContent
            key={displayedAsset.video.videoId}
            asset={displayedAsset}
            open={open}
            workspaceSlug={workspaceSlug}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-1/2 w-[calc(100vw-2rem)] max-w-[60rem] -translate-y-1/2 overflow-hidden rounded-xl shadow-2xl ring-1 ring-foreground/10"
      >
        <DialogTitle className="sr-only">{displayedAsset.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {accessibleDescription}
        </DialogDescription>
        <DialogBody className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-xl border-0 bg-background p-0">
          <VideoViewerContent
            key={displayedAsset.video.videoId}
            asset={displayedAsset}
            open={open}
            workspaceSlug={workspaceSlug}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function VideoViewerContent({
  asset,
  open,
  workspaceSlug,
}: {
  asset: VideoLinkAsset;
  open: boolean;
  workspaceSlug: string;
}) {
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const embedUrl = youtubeEmbedUrl(asset.video.videoId);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative isolate m-2 aspect-video shrink-0 overflow-hidden rounded-md bg-background sm:m-3">
        {asset.previewImage ? (
          <>
            <img
              src={asset.previewImage.url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl saturate-125"
            />
            <img
              src={asset.previewImage.url}
              alt=""
              aria-hidden="true"
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
                playerLoaded ? "opacity-0" : "opacity-90",
              )}
            />
            <div className="absolute inset-0 bg-black/25" aria-hidden="true" />
          </>
        ) : null}

        <iframe
          src={embedUrl}
          title={asset.title}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setPlayerLoaded(true)}
          className={cn(
            "absolute inset-0 block size-full rounded-md border-none outline-none ring-0 transition-opacity duration-300 motion-reduce:transition-none",
            playerLoaded ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <div className="space-y-1 bg-background px-4 pt-0 pb-4 sm:px-5 sm:pb-5">
        <h2 className="font-heading text-lg leading-snug font-medium text-balance sm:text-xl">
          {asset.title}
        </h2>
        {asset.video.channelName ? (
          asset.video.channelUrl ? (
            <a
              href={asset.video.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {asset.video.channelName}
              <ExternalLinkIcon className="size-3.5" />
              <span className="sr-only">Opens channel in a new tab</span>
            </a>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              {asset.video.channelName}
            </p>
          )
        ) : null}
        {asset.description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
            {asset.description}
          </p>
        ) : null}
        <VideoLinkNoteEditor
          asset={asset}
          open={open}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </div>
  );
}

function VideoLinkNoteEditor({
  asset,
  open,
  workspaceSlug,
}: {
  asset: VideoLinkAsset;
  open: boolean;
  workspaceSlug: string;
}) {
  const { mutateAsync: updateLinkAsync } = useUpdateLink(workspaceSlug);
  const [note, setNote] = useState("");
  const assetIdRef = useRef<string | undefined>(undefined);
  const assetNoteRef = useRef(asset.note);
  const draftRef = useRef("");
  const savedRef = useRef(new Map<string, string>());
  const timerRef = useRef<number | undefined>(undefined);
  const requestRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(new Map<string, string>());

  assetNoteRef.current = asset.note;

  const persistNote = useCallback(
    (assetId: string, draft: string) => {
      const nextNote = draft.trim() ? draft : null;
      const saved = savedRef.current.get(assetId) ?? null;
      if (nextNote === saved) {
        clearLinkNoteDraft(workspaceSlug, assetId);
        return;
      }

      if (requestRef.current) {
        queuedRef.current.set(assetId, draft);
        return;
      }

      const request = updateLinkAsync({ assetId, note: nextNote })
        .then(({ link }) => {
          const savedNote = link.note ?? "";
          savedRef.current.set(assetId, savedNote);

          if (assetIdRef.current === assetId) {
            if (draftRef.current === draft) {
              draftRef.current = savedNote;
              setNote(savedNote);
              clearLinkNoteDraft(workspaceSlug, assetId);
            } else {
              queuedRef.current.set(assetId, draftRef.current);
            }
          } else {
            clearLinkNoteDraft(workspaceSlug, assetId);
          }
        })
        .catch((error: unknown) => {
          saveLinkNoteDraft(workspaceSlug, assetId, draft);
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not save link note.",
          );
        })
        .finally(() => {
          requestRef.current = null;
          const queued = queuedRef.current.get(assetId);
          if (queued !== undefined) {
            queuedRef.current.delete(assetId);
            persistNote(assetId, queued);
            return;
          }

          const nextQueued = queuedRef.current.entries().next().value;
          if (nextQueued) {
            const [nextAssetId, nextDraft] = nextQueued;
            queuedRef.current.delete(nextAssetId);
            persistNote(nextAssetId, nextDraft);
          }
        });

      requestRef.current = request;
    },
    [updateLinkAsync, workspaceSlug],
  );

  const flushNote = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    const assetId = assetIdRef.current;
    if (assetId) persistNote(assetId, draftRef.current);
  }, [persistNote]);

  useEffect(() => {
    flushNote();

    const assetId = asset.id;
    const serverNote = assetNoteRef.current ?? "";
    const recoveredDraft = readLinkNoteDraft(
      workspaceSlug,
      assetId,
      Boolean(serverNote),
    );
    const nextDraft = recoveredDraft ?? serverNote;

    assetIdRef.current = assetId;
    savedRef.current.set(assetId, serverNote);
    draftRef.current = nextDraft;
    setNote(nextDraft);

    if (recoveredDraft !== undefined && recoveredDraft !== serverNote) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        persistNote(assetId, recoveredDraft);
      }, LINK_NOTE_AUTOSAVE_DELAY_MS);
    }
  }, [asset.id, flushNote, persistNote, workspaceSlug]);

  useEffect(() => {
    if (!open) flushNote();
  }, [flushNote, open]);

  useEffect(() => () => flushNote(), [flushNote]);

  const handleChange = useCallback(
    (value: string) => {
      const assetId = assetIdRef.current;
      if (!assetId) return;

      draftRef.current = value;
      setNote(value);
      saveLinkNoteDraft(workspaceSlug, assetId, value);

      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        persistNote(assetId, draftRef.current);
      }, LINK_NOTE_AUTOSAVE_DELAY_MS);
    },
    [persistNote, workspaceSlug],
  );

  return (
    <div className="pt-3">
      <label
        htmlFor={`link-note-${asset.id}`}
        className="text-xs font-medium text-muted-foreground"
      >
        Notes
      </label>
      <AutoResizeTextarea
        id={`link-note-${asset.id}`}
        spellCheck={false}
        value={note}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Add a note"
        rows={1}
        className="mt-1 block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
      />
    </div>
  );
}

function isVideoLinkAsset(
  asset: LinkAsset | undefined,
): asset is VideoLinkAsset {
  return asset?.video?.provider === "youtube";
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
}
