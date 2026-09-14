export type CanvasViewAction = "zoom-in" | "zoom-out" | "set-zoom" | "fit-view";

export function getCanvasViewShortcutAction(
  event: Pick<
    KeyboardEvent,
    "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
  >,
): CanvasViewAction | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;

  if (event.key === "+") return "zoom-in";
  if (event.key === "-") return "zoom-out";
  if (event.key === "1" && !event.shiftKey) return "fit-view";

  return undefined;
}
