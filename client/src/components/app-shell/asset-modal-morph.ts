const OPEN_DURATION = 400;
const CLOSE_DURATION = 350;
const MORPH_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type AssetOrigin = "canvas" | "grid";

function visibleArea(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const viewport =
    element.closest<HTMLElement>(".aska-flow") ??
    element.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
  const clip = viewport?.getBoundingClientRect();
  const left = Math.max(0, rect.left, clip?.left ?? 0);
  const top = Math.max(0, rect.top, clip?.top ?? 0);
  const right = Math.min(innerWidth, rect.right, clip?.right ?? innerWidth);
  const bottom = Math.min(
    innerHeight,
    rect.bottom,
    clip?.bottom ?? innerHeight,
  );
  return { width: right - left, height: bottom - top };
}

export function canMorphAssetModal() {
  return (
    document.visibilityState === "visible" &&
    typeof Element !== "undefined" &&
    typeof Element.prototype.animate === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function findVisibleAssetCard(assetId: string, origin?: AssetOrigin) {
  for (const card of document.querySelectorAll<HTMLElement>(
    "[data-canvas-asset-id], [data-asset-card-id]",
  )) {
    const cardAssetId = card.dataset.canvasAssetId ?? card.dataset.assetCardId;
    if (cardAssetId !== assetId || !card.isConnected) continue;
    const inCanvas = Boolean(card.closest(".aska-flow"));
    if (origin && inCanvas !== (origin === "canvas")) continue;
    const area = visibleArea(card);
    if (area.width >= 16 && area.height >= 16) return card;
  }
  return undefined;
}

export function findAssetModal(assetId: string) {
  const modals = document.querySelectorAll<HTMLElement>(
    "[data-workspace-asset-modal]",
  );
  if (modals.length !== 1) return undefined;
  return modals[0].dataset.workspaceAssetModal === assetId
    ? modals[0]
    : undefined;
}

export function startAssetModalMorph(
  direction: "open" | "close",
  card: HTMLElement,
  modal: HTMLElement,
) {
  const cardSurface =
    card.querySelector<HTMLElement>("[data-note-card-surface]") ?? card;
  const surfaceRect = cardSurface.getBoundingClientRect();
  const modalRect = modal.getBoundingClientRect();
  if (
    !surfaceRect.width ||
    !surfaceRect.height ||
    !modalRect.width ||
    !modalRect.height ||
    typeof modal.animate !== "function"
  )
    return undefined;

  const backdrop =
    modal.parentElement?.querySelector<HTMLElement>(
      ".workspace-asset-view-backdrop",
    ) ?? document.querySelector<HTMLElement>(".workspace-asset-view-backdrop");
  const cardStyle = getComputedStyle(cardSurface);
  const modalStyle = getComputedStyle(modal);
  const previousModalStyle = modal.style.cssText;
  const previousCardVisibility = card.style.visibility;
  const previousMorphing = modal.dataset.assetMorphing;
  const previousPointerEvents = modal.style.pointerEvents;
  const from = direction === "open" ? surfaceRect : modalRect;
  const to = direction === "open" ? modalRect : surfaceRect;
  const sourceScaleX = cardSurface.offsetWidth
    ? surfaceRect.width / cardSurface.offsetWidth
    : 1;
  const sourceScaleY = cardSurface.offsetHeight
    ? surfaceRect.height / cardSurface.offsetHeight
    : sourceScaleX;
  const cardRadius = cardStyle.borderRadius;
  const modalRadius = modalStyle.borderRadius;
  const cardBackground = cardStyle.backgroundColor;
  const modalBackground = modalStyle.backgroundColor;
  const cardShadow = cardStyle.boxShadow;
  const modalShadow = modalStyle.boxShadow;
  const preview = document.createElement("div");
  const cardClone = cardSurface.cloneNode(true) as HTMLElement;
  preview.dataset.assetMorphPreview = "";
  preview.setAttribute("aria-hidden", "true");
  preview.inert = true;
  Object.assign(preview.style, {
    position: "fixed",
    top: `${from.top}px`,
    left: `${from.left}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    borderRadius: direction === "open" ? cardRadius : modalRadius,
    zIndex: "110",
    overflow: "hidden",
    pointerEvents: "none",
  });
  cardClone.removeAttribute("id");
  cardClone
    .querySelectorAll("[id]")
    .forEach((element) => element.removeAttribute("id"));
  cardClone
    .querySelectorAll<HTMLElement>("a, button, input, [tabindex]")
    .forEach((element) => {
      element.tabIndex = -1;
    });
  Object.assign(cardClone.style, {
    width: `${100 / sourceScaleX}%`,
    height: `${100 / sourceScaleY}%`,
    maxWidth: "none",
    maxHeight: "none",
    margin: "0",
    transform: `scale(${sourceScaleX}, ${sourceScaleY})`,
    transformOrigin: "top left",
    translate: "none",
    pointerEvents: "none",
  });
  preview.append(cardClone);
  document.body.append(preview);

  // Move the live note dialog's actual edges. Scaling the full-size editor
  // distorts its text and makes the handoff from the card visibly jump.
  modal.dataset.assetMorphing = direction;
  modal.style.pointerEvents = "none";
  card.style.visibility = "hidden";
  Object.assign(modal.style, {
    top: `${modalRect.top}px`,
    left: `${modalRect.left}px`,
    right: "auto",
    bottom: "auto",
    width: `${modalRect.width}px`,
    height: `${modalRect.height}px`,
    maxWidth: "none",
    maxHeight: "none",
    transform: "none",
    transformOrigin: "top left",
    translate: "none",
    scale: "1",
    transition: "none",
    animation: "none",
  });
  let panelAnimation: Animation | undefined;
  let previewAnimation: Animation | undefined;
  let backdropAnimation: Animation | undefined;
  try {
    panelAnimation = modal.animate(
      [
        {
          top: `${from.top}px`,
          left: `${from.left}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          borderRadius: direction === "open" ? cardRadius : modalRadius,
          backgroundColor:
            direction === "open" ? cardBackground : modalBackground,
          boxShadow: direction === "open" ? cardShadow : modalShadow,
        },
        {
          top: `${to.top}px`,
          left: `${to.left}px`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          borderRadius: direction === "open" ? modalRadius : cardRadius,
          backgroundColor:
            direction === "open" ? modalBackground : cardBackground,
          boxShadow: direction === "open" ? modalShadow : cardShadow,
        },
      ],
      {
        duration: direction === "open" ? OPEN_DURATION : CLOSE_DURATION,
        easing: MORPH_EASING,
        fill: "both",
      },
    );
    previewAnimation = preview.animate(
      direction === "open"
        ? [
            {
              top: `${from.top}px`,
              left: `${from.left}px`,
              width: `${from.width}px`,
              height: `${from.height}px`,
              borderRadius: cardRadius,
              opacity: 1,
              offset: 0,
            },
            { opacity: 1, offset: 0.18 },
            {
              top: `${to.top}px`,
              left: `${to.left}px`,
              width: `${to.width}px`,
              height: `${to.height}px`,
              borderRadius: modalRadius,
              opacity: 0,
              offset: 1,
            },
          ]
        : [
            {
              top: `${from.top}px`,
              left: `${from.left}px`,
              width: `${from.width}px`,
              height: `${from.height}px`,
              borderRadius: modalRadius,
              opacity: 0,
              offset: 0,
            },
            { opacity: 0, offset: 0.3 },
            {
              top: `${to.top}px`,
              left: `${to.left}px`,
              width: `${to.width}px`,
              height: `${to.height}px`,
              borderRadius: cardRadius,
              opacity: 1,
              offset: 1,
            },
          ],
      {
        duration: direction === "open" ? OPEN_DURATION : CLOSE_DURATION,
        easing: MORPH_EASING,
        fill: "both",
      },
    );
    backdropAnimation = backdrop?.animate?.(
      direction === "open"
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0 }],
      { duration: direction === "open" ? 250 : 150, fill: "both" },
    );
    void previewAnimation?.finished.catch(() => undefined);
    void backdropAnimation?.finished.catch(() => undefined);
  } catch {
    panelAnimation?.cancel();
    previewAnimation?.cancel();
    preview.remove();
    modal.style.cssText = previousModalStyle;
    modal.style.pointerEvents = previousPointerEvents;
    card.style.visibility = previousCardVisibility;
    if (previousMorphing === undefined) delete modal.dataset.assetMorphing;
    else modal.dataset.assetMorphing = previousMorphing;
    return undefined;
  }
  if (!panelAnimation) return undefined;

  let cleanedUp = false;
  const cleanup = (restoreCard: boolean) => {
    if (cleanedUp) return;
    cleanedUp = true;
    panelAnimation.cancel();
    previewAnimation?.cancel();
    backdropAnimation?.cancel();
    preview.remove();
    modal.style.cssText = previousModalStyle;
    modal.style.pointerEvents = previousPointerEvents;
    if (restoreCard) card.style.visibility = previousCardVisibility;
    if (previousMorphing === undefined) delete modal.dataset.assetMorphing;
    else modal.dataset.assetMorphing = previousMorphing;
  };
  const finished = panelAnimation.finished.then(
    () => cleanup(direction === "close"),
    () => cleanup(true),
  );
  return { finished, cancel: () => cleanup(true) };
}
