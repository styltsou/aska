import type { DetailedCollection } from "@/api/collection/types";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogBody className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Collection properties</DialogTitle>
            <DialogDescription>{collection.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-sidebar p-3">
              <p className="text-xs text-muted-foreground">Assets</p>
              <p className="mt-1 text-xl font-medium tabular-nums">
                {numberFormat.format(collection.assetCount)}
              </p>
            </div>
            <div className="rounded-md bg-sidebar p-3">
              <p className="text-xs text-muted-foreground">Original media</p>
              <p className="mt-1 text-xl font-medium tabular-nums">
                {formatBytes(properties.originalMediaSizeBytes)}
              </p>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Original image and video files stored in this collection.
          </p>
          <dl className="divide-y divide-border text-sm">
            {(
              [
                ["Images", properties.imageCount],
                ["Videos", properties.videoCount],
                ["Notes", properties.noteCount],
                ["Links", properties.linkCount],
                ["Colors", properties.colorCount],
                ["Folders", properties.folderCount],
              ] as const
            ).map(([label, count]) => (
              <div
                key={label}
                className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">
                  {numberFormat.format(count)}
                </dd>
              </div>
            ))}
          </dl>
          <dl className="divide-y divide-border border-t border-border pt-2 text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {dateFormat.format(new Date(collection.createdAt))}
              </dd>
            </div>
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
