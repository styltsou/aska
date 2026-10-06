import { restoreStyleWithoutTransition } from "@/lib/restore-style-without-transition";

const OPEN_DURATION = 400;
const CLOSE_DURATION = 350;
const MORPH_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type AssetOrigin = "canvas" | "grid";

function inertClone(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone
    .querySelectorAll("[id]")
    .forEach((element) => element.removeAttribute("id"));
  clone
    .querySelectorAll("[data-asset-morph-omit]")
    .forEach((element) => element.remove());
  clone
    .querySelectorAll<HTMLElement>("a, button, input, [tabindex]")
    .forEach((element) => {
      element.tabIndex = -1;
    });
  return clone;
}

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
  restoredCardVisibility?: string,
) {
  const cardSurface =
    card.querySelector<HTMLElement>("[data-asset-card-surface]") ?? card;
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
  const previousCardOpacity = card.style.opacity;
  const previousCardPointerEvents = card.style.pointerEvents;
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
  const cardHero = cardSurface.querySelector<HTMLElement>(
    "[data-asset-card-hero]",
  );
  const isColorSwatch = cardHero?.dataset.assetCardHero === "color";
  const keepsOpaqueHero =
    isColorSwatch ||
    cardHero?.dataset.assetCardHero === "image" ||
    cardHero?.dataset.assetCardHero === "video";
  const modalHero = modal.querySelector<HTMLElement>("[data-asset-modal-hero]");
  const cardHeroRect = cardHero?.getBoundingClientRect();
  const modalHeroRect = modalHero?.getBoundingClientRect();
  const morphHero = Boolean(
    cardHero &&
    modalHero &&
    cardHeroRect?.width &&
    cardHeroRect.height &&
    modalHeroRect?.width &&
    modalHeroRect.height,
  );
  const preview = document.createElement("div");
  const cardClone = inertClone(cardSurface);
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
  if (morphHero) {
    const clonedHero = cardClone.querySelector<HTMLElement>(
      "[data-asset-card-hero]",
    );
    if (clonedHero) clonedHero.style.visibility = "hidden";
  }
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

  let heroPreview: HTMLElement | undefined;
  const cardHeroRadius = cardHero
    ? getComputedStyle(cardHero).borderRadius
    : "";
  const modalHeroRadius = modalHero
    ? getComputedStyle(modalHero).borderRadius
    : "";
  if (morphHero && cardHero && cardHeroRect && modalHeroRect) {
    const heroFrom = direction === "open" ? cardHeroRect : modalHeroRect;
    const heroClone = inertClone(cardHero);
    const heroScaleX = cardHero.offsetWidth
      ? cardHeroRect.width / cardHero.offsetWidth
      : 1;
    const heroScaleY = cardHero.offsetHeight
      ? cardHeroRect.height / cardHero.offsetHeight
      : heroScaleX;
    heroPreview = document.createElement("div");
    heroPreview.dataset.assetMorphHero = "";
    heroPreview.setAttribute("aria-hidden", "true");
    heroPreview.inert = true;
    Object.assign(heroPreview.style, {
      position: "fixed",
      top: `${heroFrom.top}px`,
      left: `${heroFrom.left}px`,
      width: `${heroFrom.width}px`,
      height: `${heroFrom.height}px`,
      borderRadius: direction === "open" ? cardHeroRadius : modalHeroRadius,
      zIndex: "111",
      overflow: "hidden",
      pointerEvents: "none",
    });
    Object.assign(heroClone.style, {
      width: `${100 / heroScaleX}%`,
      height: `${100 / heroScaleY}%`,
      maxWidth: "none",
      maxHeight: "none",
      margin: "0",
      transform: `scale(${heroScaleX}, ${heroScaleY})`,
      transformOrigin: "top left",
      translate: "none",
      pointerEvents: "none",
    });
    heroPreview.append(heroClone);
    document.body.append(heroPreview);
  }

  // Move the live dialog's actual edges. Scaling a full-size modal distorts
  // its content and makes the handoff from the card visibly jump.
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
  let heroAnimation: Animation | undefined;
  let modalHeroAnimation: Animation | undefined;
  let cardRevealAnimation: Animation | undefined;
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
            ...(isColorSwatch ? [{ opacity: 0, offset: 0.6 }] : []),
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
            { opacity: 0, offset: isColorSwatch ? 0.4 : 0.3 },
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
    if (heroPreview && cardHeroRect && modalHeroRect && modalHero) {
      const heroFrom = direction === "open" ? cardHeroRect : modalHeroRect;
      const heroTo = direction === "open" ? modalHeroRect : cardHeroRect;
      const duration = direction === "open" ? OPEN_DURATION : CLOSE_DURATION;
      // Keep visual media opaque until the live element takes over. A
      // translucent crossfade visibly changes colors and image contrast.
      heroAnimation = heroPreview.animate(
        direction === "open"
          ? [
              {
                top: `${heroFrom.top}px`,
                left: `${heroFrom.left}px`,
                width: `${heroFrom.width}px`,
                height: `${heroFrom.height}px`,
                borderRadius: cardHeroRadius,
                opacity: 1,
                offset: 0,
              },
              ...(keepsOpaqueHero ? [] : [{ opacity: 1, offset: 0.65 }]),
              {
                top: `${heroTo.top}px`,
                left: `${heroTo.left}px`,
                width: `${heroTo.width}px`,
                height: `${heroTo.height}px`,
                borderRadius: modalHeroRadius,
                opacity: keepsOpaqueHero ? 1 : 0,
                offset: 1,
              },
            ]
          : [
              {
                top: `${heroFrom.top}px`,
                left: `${heroFrom.left}px`,
                width: `${heroFrom.width}px`,
                height: `${heroFrom.height}px`,
                borderRadius: modalHeroRadius,
                opacity: keepsOpaqueHero ? 1 : 0,
                offset: 0,
              },
              ...(keepsOpaqueHero ? [] : [{ opacity: 1, offset: 0.35 }]),
              {
                top: `${heroTo.top}px`,
                left: `${heroTo.left}px`,
                width: `${heroTo.width}px`,
                height: `${heroTo.height}px`,
                borderRadius: cardHeroRadius,
                opacity: 1,
                offset: 1,
              },
            ],
        { duration, easing: MORPH_EASING, fill: "both" },
      );
      modalHeroAnimation = modalHero.animate(
        keepsOpaqueHero
          ? [{ opacity: 0 }, { opacity: 0 }]
          : direction === "open"
            ? [
                { opacity: 0, offset: 0 },
                { opacity: 0, offset: 0.65 },
                { opacity: 1, offset: 1 },
              ]
            : [
                { opacity: 1, offset: 0 },
                { opacity: 0, offset: 0.35 },
                { opacity: 0, offset: 1 },
              ],
        { duration, easing: "linear", fill: "both" },
      );
    }
    if (
      keepsOpaqueHero &&
      direction === "close" &&
      restoredCardVisibility !== undefined
    ) {
      // Give the real card a painted frame before removing its moving copy.
      card.style.visibility = restoredCardVisibility;
      card.style.opacity = "0.01";
      card.style.pointerEvents = "none";
      cardRevealAnimation = card.animate(
        [
          { opacity: 0.01, offset: 0 },
          { opacity: 0.01, offset: 0.75 },
          { opacity: 1, offset: 0.92 },
          { opacity: 1, offset: 1 },
        ],
        { duration: CLOSE_DURATION, easing: "linear", fill: "both" },
      );
    }
    void previewAnimation?.finished.catch(() => undefined);
    void backdropAnimation?.finished.catch(() => undefined);
    void heroAnimation?.finished.catch(() => undefined);
    void modalHeroAnimation?.finished.catch(() => undefined);
    void cardRevealAnimation?.finished.catch(() => undefined);
  } catch {
    panelAnimation?.cancel();
    previewAnimation?.cancel();
    backdropAnimation?.cancel();
    heroAnimation?.cancel();
    modalHeroAnimation?.cancel();
    cardRevealAnimation?.cancel();
    preview.remove();
    heroPreview?.remove();
    restoreStyleWithoutTransition(modal, previousModalStyle);
    modal.style.pointerEvents = previousPointerEvents;
    card.style.visibility = previousCardVisibility;
    card.style.opacity = previousCardOpacity;
    card.style.pointerEvents = previousCardPointerEvents;
    if (previousMorphing === undefined) delete modal.dataset.assetMorphing;
    else modal.dataset.assetMorphing = previousMorphing;
    return undefined;
  }
  if (!panelAnimation) return undefined;

  let cleanedUp = false;
  const cleanup = (
    restoreCard: boolean,
    cardVisibility = previousCardVisibility,
  ) => {
    if (cleanedUp) return;
    cleanedUp = true;
    panelAnimation.cancel();
    previewAnimation?.cancel();
    backdropAnimation?.cancel();
    heroAnimation?.cancel();
    modalHeroAnimation?.cancel();
    cardRevealAnimation?.cancel();
    if (restoreCard) card.style.visibility = cardVisibility;
    card.style.opacity = previousCardOpacity;
    card.style.pointerEvents = previousCardPointerEvents;
    preview.remove();
    heroPreview?.remove();
    restoreStyleWithoutTransition(modal, previousModalStyle);
    modal.style.pointerEvents = previousPointerEvents;
    if (previousMorphing === undefined) delete modal.dataset.assetMorphing;
    else modal.dataset.assetMorphing = previousMorphing;
  };
  const finished = panelAnimation.finished.then(
    () => cleanup(direction === "close", restoredCardVisibility),
    () => cleanup(true),
  );
  return { finished, cancel: () => cleanup(true) };
}
