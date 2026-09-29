import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const FULLSCREEN_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function panelSnapshot(panel: HTMLElement) {
  const rect = panel.getBoundingClientRect();
  const style = getComputedStyle(panel);
  return {
    rect,
    radius: style.borderRadius,
    background: style.backgroundColor,
    shadow: style.boxShadow,
  };
}

export function useAssetFullscreenMorph(enabled: boolean, expanded: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastPanelRef = useRef<HTMLDivElement | null>(null);
  const previousExpandedRef = useRef<boolean | undefined>(undefined);
  const animationRef = useRef<Animation | null>(null);
  const baseStyleRef = useRef<string | null>(null);
  const previousSnapshotRef = useRef<ReturnType<typeof panelSnapshot> | null>(
    null,
  );
  const setPanelRef = useCallback((panel: HTMLDivElement | null) => {
    panelRef.current = panel;
    if (panel && panel !== lastPanelRef.current && !animationRef.current)
      previousSnapshotRef.current = panelSnapshot(panel);
    if (panel) lastPanelRef.current = panel;
  }, []);
  const captureCurrentRect = useCallback(() => {
    const panel = panelRef.current;
    if (panel && !animationRef.current)
      previousSnapshotRef.current = panelSnapshot(panel);
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const previousExpanded = previousExpandedRef.current;
    previousExpandedRef.current = expanded;
    if (!panel) return;

    const stop = () => {
      animationRef.current?.cancel();
      animationRef.current = null;
      if (baseStyleRef.current !== null) {
        panel.style.cssText = baseStyleRef.current;
        baseStyleRef.current = null;
      }
    };

    if (!enabled) {
      stop();
      previousSnapshotRef.current = panelSnapshot(panel);
      return;
    }
    if (previousExpanded === undefined || previousExpanded === expanded) {
      if (!animationRef.current)
        previousSnapshotRef.current = panelSnapshot(panel);
      return;
    }

    // A layout class may snap directly to its destination before this effect.
    // Use the last settled rectangle, or the painted one during a reversal.
    const fromSnapshot = animationRef.current
      ? panelSnapshot(panel)
      : (previousSnapshotRef.current ?? panelSnapshot(panel));
    const from = fromSnapshot.rect;
    stop();

    const baseStyle = panel.style.cssText;
    panel.style.transition = "none";
    panel.style.animation = "none";
    const toSnapshot = panelSnapshot(panel);
    const to = toSnapshot.rect;
    previousSnapshotRef.current = toSnapshot;

    if (
      typeof panel.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      (Math.abs(from.left - to.left) < 1 &&
        Math.abs(from.top - to.top) < 1 &&
        Math.abs(from.width - to.width) < 1 &&
        Math.abs(from.height - to.height) < 1)
    ) {
      panel.style.cssText = baseStyle;
      return;
    }

    baseStyleRef.current = baseStyle;
    Object.assign(panel.style, {
      top: `${to.top}px`,
      left: `${to.left}px`,
      right: "auto",
      bottom: "auto",
      width: `${to.width}px`,
      height: `${to.height}px`,
      maxWidth: "none",
      maxHeight: "none",
      transform: "none",
      translate: "none",
      scale: "1",
      transformOrigin: "top left",
      transition: "none",
      animation: "none",
    });

    let animation: Animation;
    try {
      animation = panel.animate(
        [
          {
            top: `${from.top}px`,
            left: `${from.left}px`,
            width: `${from.width}px`,
            height: `${from.height}px`,
            borderRadius: fromSnapshot.radius,
            backgroundColor: fromSnapshot.background,
            boxShadow: fromSnapshot.shadow,
          },
          {
            top: `${to.top}px`,
            left: `${to.left}px`,
            width: `${to.width}px`,
            height: `${to.height}px`,
            borderRadius: toSnapshot.radius,
            backgroundColor: toSnapshot.background,
            boxShadow: toSnapshot.shadow,
          },
        ],
        {
          duration: expanded ? 400 : 350,
          easing: FULLSCREEN_EASING,
          fill: "both",
        },
      );
    } catch {
      panel.style.cssText = baseStyle;
      baseStyleRef.current = null;
      previousSnapshotRef.current = panelSnapshot(panel);
      return;
    }

    animationRef.current = animation;
    const finish = () => {
      if (animationRef.current !== animation) return;
      animation.cancel();
      animationRef.current = null;
      panel.style.cssText = baseStyle;
      baseStyleRef.current = null;
    };
    void animation.finished.then(finish, finish);
  }, [enabled, expanded]);

  useEffect(
    () => () => {
      animationRef.current?.cancel();
      if (panelRef.current && baseStyleRef.current !== null)
        panelRef.current.style.cssText = baseStyleRef.current;
    },
    [],
  );

  return { panelRef: setPanelRef, captureCurrentRect };
}
