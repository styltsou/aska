import { useState } from "react";
import { toast } from "sonner";

import {
  useCreateColor,
  useCreateInboxColor,
  useUpdateColor,
  type BoardInsertionPlacement,
} from "@/api/collection";
import { SimpleColorPicker } from "@/components/ui/color-picker";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ColorAsset } from "@/types/asset";

export function ColorEditorDialog({
  workspaceSlug,
  collectionPath,
  target = "collection",
  color,
  children,
  open: controlledOpen,
  onOpenChange,
  placement,
}: {
  workspaceSlug: string;
  collectionPath?: string;
  target?: "collection" | "inbox";
  color?: ColorAsset;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: BoardInsertionPlacement;
}) {
  const [collectionSlug = "", ...folderSegments] = (collectionPath ?? "")
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const createColor = useCreateColor(workspaceSlug, collectionSlug);
  const createInboxColor = useCreateInboxColor(workspaceSlug);
  const updateColor = useUpdateColor(workspaceSlug);
  const [internalOpen, setInternalOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(color?.hex ?? "#00a8ff");
  const [isGradient, setIsGradient] = useState(Boolean(color?.gradient));
  const [gradientEnd, setGradientEnd] = useState(
    color?.gradient?.to ?? "#7c3aed",
  );
  const [gradientAngle, setGradientAngle] = useState(
    color?.gradient?.angle ?? 135,
  );
  const open = controlledOpen ?? internalOpen;
  const isEditing = color !== undefined;
  const isPending = isEditing
    ? updateColor.isPending
    : target === "inbox"
      ? createInboxColor.isPending
      : createColor.isPending;

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
  }

  async function handleSave() {
    const gradient = isGradient
      ? { from: draftHex, to: gradientEnd, angle: gradientAngle }
      : null;
    try {
      if (color) {
        await updateColor.mutateAsync({
          assetId: color.id,
          hex: draftHex,
          gradient,
        });
        toast.success("Color updated.");
      } else if (target === "inbox") {
        await createInboxColor.mutateAsync({
          hex: draftHex,
          ...(gradient ? { gradient } : {}),
        });
        toast.success("Color added to Inbox.");
      } else {
        await createColor.mutateAsync({
          hex: draftHex,
          ...(gradient ? { gradient } : {}),
          parentFolderPath,
          placement,
        });
        toast.success("Color added.");
      }
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save color.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger render={children} /> : null}
      <DialogContent>
        <DialogBody className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit color" : "New color"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Refine this swatch using the color field."
                : "Choose a color to add as a swatch."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
            <div
              className="h-36 rounded-md border border-border"
              style={{
                background: isGradient
                  ? `linear-gradient(${gradientAngle}deg, ${draftHex}, ${gradientEnd})`
                  : draftHex,
              }}
            />
            <SimpleColorPicker
              initialHex={color?.hex}
              onPick={() => undefined}
              onChange={setDraftHex}
              showAction={false}
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={draftHex}
              onChange={(event) => setDraftHex(event.target.value)}
              aria-label="Primary hex color"
            />
            {isGradient ? (
              <Input
                value={gradientEnd}
                onChange={(event) => setGradientEnd(event.target.value)}
                aria-label="Gradient end hex color"
              />
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsGradient((value) => !value)}
            >
              {isGradient ? "Use solid color" : "Add gradient"}
            </Button>
            {isGradient ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Angle{" "}
                <input
                  className="w-24"
                  type="range"
                  min="0"
                  max="360"
                  value={gradientAngle}
                  onChange={(event) =>
                    setGradientAngle(Number(event.target.value))
                  }
                />{" "}
                {gradientAngle}°
              </label>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose
            render={
              <Button className="min-w-24" variant="outline">
                Cancel
              </Button>
            }
          />
          <Button
            className="min-w-24"
            disabled={isPending}
            onClick={() => void handleSave()}
          >
            {isEditing ? "Save color" : "Create color"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
