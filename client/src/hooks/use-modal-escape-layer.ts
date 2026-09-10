import { useCallback, useEffect, useRef, useState } from "react";

type ModalChangeDetails = {
  reason: string;
  event: Event;
  cancel: () => void;
};

const activeLayers = new Map<symbol, number>();
let nextLayerOrder = 0;

export function isTopmostModalEscapeLayer(
  order: number | undefined,
  activeOrders: Iterable<number>,
) {
  if (order === undefined) return false;
  let highestOrder: number | undefined;
  for (const activeOrder of activeOrders) {
    if (highestOrder === undefined || activeOrder > highestOrder) {
      highestOrder = activeOrder;
    }
  }
  return order === highestOrder;
}

/**
 * Coordinates independently rendered Base UI modal roots. Base UI handles
 * nested roots already, but our detail surfaces are siblings in the route
 * tree; without this guard each can observe the same Escape event.
 */
export function useModalEscapeLayer(open: boolean) {
  const layerId = useRef(Symbol("modal-escape-layer"));
  const [order, setOrder] = useState<number>();

  useEffect(() => {
    if (!open) return;

    const id = layerId.current;
    const nextOrder = ++nextLayerOrder;
    activeLayers.set(id, nextOrder);
    setOrder(nextOrder);

    return () => {
      activeLayers.delete(id);
      setOrder(undefined);
    };
  }, [open]);

  return useCallback(
    (details: ModalChangeDetails) => {
      if (details.reason !== "escape-key") return true;

      const isTopmost =
        activeLayers.get(layerId.current) === order &&
        isTopmostModalEscapeLayer(order, activeLayers.values());

      if (details.event instanceof KeyboardEvent && details.event.repeat) {
        details.cancel();
        return false;
      }

      if (!isTopmost) {
        details.cancel();
        return false;
      }

      return true;
    },
    [order],
  );
}

/**
 * Makes controlled and uncontrolled Base UI roots participate in the same
 * Escape ordering without changing their public controlled-state contract.
 */
export function useCoordinatedModalOpen<Details extends ModalChangeDetails>(
  controlledOpen: boolean | undefined,
  defaultOpen: boolean | undefined,
  onOpenChange: ((open: boolean, details: Details) => void) | undefined,
) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    defaultOpen ?? false,
  );
  const open = controlledOpen ?? uncontrolledOpen;
  const canHandleEscape = useModalEscapeLayer(open);

  const handleOpenChange = useCallback(
    (nextOpen: boolean, details: Details) => {
      if (!nextOpen && !canHandleEscape(details)) return;
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen, details);
    },
    [canHandleEscape, controlledOpen, onOpenChange],
  );

  return { open, handleOpenChange };
}
