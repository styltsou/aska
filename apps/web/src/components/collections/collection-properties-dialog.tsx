import type { DetailedCollection } from "@/api/collection/types";
import {
  CalendarDaysIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  Link2Icon,
  PaletteIcon,
  VideoIcon,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const numberFormat = new Intl.NumberFormat();
const byteFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${numberFormat.format(bytes)} B`;
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  const value = bytes / 1024 ** unit;
  return `${byteFormat.format(value)} ${["B", "KB", "MB", "GB", "TB"][unit]}`;
}

export function CollectionPropertiesDialog({
  open,
  onOpenChange,
  collection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: DetailedCollection;
}) {
  const properties = collection.properties;
  const contentItems = [
    { label: "Images", count: properties.imageCount, Icon: ImageIcon },
    { label: "Videos", count: properties.videoCount, Icon: VideoIcon },
    { label: "Notes", count: properties.noteCount, Icon: FileTextIcon },
    { label: "Links", count: properties.linkCount, Icon: Link2Icon },
    { label: "Colors", count: properties.colorCount, Icon: PaletteIcon },
    { label: "Folders", count: properties.folderCount, Icon: FolderIcon },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogBody className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Collection properties</DialogTitle>
            <DialogDescription>{collection.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 rounded-lg bg-muted px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Original media</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {formatBytes(properties.originalMediaSizeBytes)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Assets</p>
              <p className="mt-1 text-lg font-medium tabular-nums">
                {numberFormat.format(collection.assetCount)}
              </p>
            </div>
          </div>
          <section>
            <h3 className="text-sm font-medium">Contents</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {contentItems.map(({ label, count, Icon }) => (
                <div
                  key={label}
                  className="flex min-w-0 items-center justify-between gap-2"
                >
                  <dt className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{label}</span>
                  </dt>
                  <dd className="shrink-0 text-sm font-medium tabular-nums">
                    {numberFormat.format(count)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <dl className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <dt className="flex items-center gap-1.5">
              <CalendarDaysIcon className="size-3.5 opacity-70" />
              Created
            </dt>
            <dd className="font-medium text-foreground/80">
              {dateFormat.format(new Date(collection.createdAt))}
            </dd>
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
