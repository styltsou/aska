import { useCollectionProperties } from "@/api/collection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const numberFormat = new Intl.NumberFormat();

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${numberFormat.format(bytes)} B`;
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  const value = bytes / 1024 ** unit;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} ${["B", "KB", "MB", "GB", "TB"][unit]}`;
}

export function CollectionPropertiesDialog({
  open,
  onOpenChange,
  collection,
  workspaceSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: { name: string; slug: string };
  workspaceSlug: string;
}) {
  const { data, isPending, isError, refetch } = useCollectionProperties(
    workspaceSlug,
    collection.slug,
    open,
  );
  const properties = data?.properties;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogBody className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Collection properties</DialogTitle>
            <DialogDescription>{collection.name}</DialogDescription>
          </DialogHeader>
          {isPending ? (
            <p className="text-sm text-muted-foreground" role="status">
              Loading properties…
            </p>
          ) : isError ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Couldn’t load collection properties.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </div>
          ) : properties ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-sidebar p-3">
                  <p className="text-xs text-muted-foreground">Assets</p>
                  <p className="mt-1 text-xl font-medium tabular-nums">
                    {numberFormat.format(properties.assetCount)}
                  </p>
                </div>
                <div className="rounded-md bg-sidebar p-3">
                  <p className="text-xs text-muted-foreground">
                    Original media
                  </p>
                  <p className="mt-1 text-xl font-medium tabular-nums">
                    {formatBytes(properties.originalMediaSizeBytes)}
                  </p>
                </div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Original image and video file sizes; generated previews are not
                included.
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
            </>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
