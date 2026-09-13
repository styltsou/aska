export type CanvasViewAction = "zoom-in" | "zoom-out" | "set-zoom" | "fit-view";

export type CanvasViewActions = {
  "zoom-in": () => void;
  "zoom-out": () => void;
  "set-zoom": (zoom: number) => void;
  "fit-view": () => void;
};

const actionsByBoardKey = new Map<string, CanvasViewActions>();

export function setCanvasViewActions(
  boardKey: string,
  actions: CanvasViewActions,
) {
  actionsByBoardKey.set(boardKey, actions);

  return () => {
    if (actionsByBoardKey.get(boardKey) === actions) {
      actionsByBoardKey.delete(boardKey);
    }
  };
}

export function runCanvasViewAction(
  boardKey: string,
  action: CanvasViewAction,
  value?: number,
) {
  if (action === "set-zoom") {
    const handler = actionsByBoardKey.get(boardKey)?.[action];
    if (value === undefined) return false;
    if (!handler) return false;
    handler(value);
  } else {
    const handler = actionsByBoardKey.get(boardKey)?.[action];
    if (!handler) return false;
    handler();
  }
  return true;
}

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
