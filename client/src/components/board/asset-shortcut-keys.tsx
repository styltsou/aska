import { Fragment } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  getPlatformAlt,
  getPlatformModifier,
  getPlatformShift,
} from "@/lib/platform";

export function AssetShortcutKeys({
  action,
}: {
  action: "peek" | "fullscreen" | "close";
}) {
  const keys =
    action === "peek"
      ? [getPlatformAlt(), getPlatformShift(), "P"]
      : action === "close"
        ? ["Esc"]
        : [getPlatformModifier(), "Enter"];

  return (
    <KbdGroup className="gap-0.5">
      {keys.map((key, index) => (
        <Fragment key={key}>
          {index > 0 ? <span>+</span> : null}
          <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">{key}</Kbd>
        </Fragment>
      ))}
    </KbdGroup>
  );
}
