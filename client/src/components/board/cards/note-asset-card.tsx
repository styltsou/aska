import type { NoteAsset } from "@/types/asset";

export function NoteAssetCard({ asset }: { asset: NoteAsset }) {
  return (
    <div className="cursor-pointer rounded-lg border bg-sidebar p-4 text-sm leading-relaxed transition-all hover:border-sidebar-foreground/20">
      {asset.content}
    </div>
  );
}
