import type { CanvasArrowObject, CanvasObject } from "@/api/collection";

import { arrowHasIdentity } from "./canvas-arrow-identity";

export type PendingCanvasArrow = {
  object: CanvasArrowObject;
  persistedId?: string;
};

export function visibleCanvasObjects(
  objects: readonly CanvasObject[],
  pendingArrows: Readonly<Record<string, PendingCanvasArrow>>,
): readonly CanvasObject[] {
  const pending = Object.values(pendingArrows);
  if (pending.length === 0) return objects;
  const visible = objects.map((object) => {
    if (object.type !== "arrow") return object;
    const match = pending.find(
      ({ object: local, persistedId }) =>
        arrowHasIdentity(object, local.id) || object.id === persistedId,
    );
    return match && object.clientId !== match.object.id
      ? { ...object, clientId: match.object.id }
      : object;
  });
  const missing = pending.filter(
    ({ object: local }) =>
      !visible.some(
        (object) =>
          object.type === "arrow" && arrowHasIdentity(object, local.id),
      ),
  );
  return missing.length === 0
    ? visible
    : [...visible, ...missing.map(({ object }) => object)];
}
