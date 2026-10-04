import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findVisibleAssetCard,
  startAssetModalMorph,
} from "./asset-modal-morph";

afterEach(() => vi.unstubAllGlobals());

describe("asset modal morph source", () => {
  it("uses a visible card in the requested board view", () => {
    const canvasViewport = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 500,
        bottom: 500,
      }),
    };
    const gridViewport = {
      getBoundingClientRect: () => ({
        left: 500,
        top: 0,
        right: 1000,
        bottom: 500,
      }),
    };
    const canvasCard = {
      dataset: { canvasAssetId: "note-1" },
      isConnected: true,
      closest: (selector: string) =>
        selector === ".aska-flow" ? canvasViewport : null,
      getBoundingClientRect: () => ({
        left: 100,
        top: 100,
        right: 300,
        bottom: 300,
      }),
    };
    let gridTop = 100;
    const gridCard = {
      dataset: { assetCardId: "note-1" },
      isConnected: true,
      closest: (selector: string) =>
        selector === '[data-slot="scroll-area-viewport"]' ? gridViewport : null,
      getBoundingClientRect: () => ({
        left: 600,
        top: gridTop,
        right: 800,
        bottom: gridTop + 200,
      }),
    };
    vi.stubGlobal("document", {
      querySelectorAll: () => [canvasCard, gridCard],
    });
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);

    expect(findVisibleAssetCard("note-1", "canvas")).toBe(canvasCard);
    expect(findVisibleAssetCard("note-1", "grid")).toBe(gridCard);
    expect(findVisibleAssetCard("note-2")).toBeUndefined();

    gridTop = 600;
    expect(findVisibleAssetCard("note-1", "grid")).toBeUndefined();
  });
});

describe("asset modal morph", () => {
  it("moves the modal from the card and keeps the source hidden after opening", async () => {
    const panelAnimation = { finished: Promise.resolve(), cancel: vi.fn() };
    const previewAnimation = { finished: Promise.resolve(), cancel: vi.fn() };
    const backdropAnimation = { finished: Promise.resolve(), cancel: vi.fn() };
    const backdrop = { animate: vi.fn(() => backdropAnimation) };
    const cardClone = {
      style: {},
      removeAttribute: vi.fn(),
      querySelectorAll: () => [],
    };
    const preview = {
      dataset: {},
      style: {},
      setAttribute: vi.fn(),
      append: vi.fn(),
      animate: vi.fn(() => previewAnimation),
      remove: vi.fn(),
    };
    const body = { append: vi.fn() };
    const card = {
      style: { visibility: "" },
      querySelector: () => null,
      cloneNode: () => cardClone,
      getBoundingClientRect: () => ({
        left: 30,
        top: 40,
        width: 200,
        height: 120,
      }),
    } as unknown as HTMLElement;
    const modal = {
      dataset: {},
      style: { cssText: "" },
      querySelector: () => null,
      parentElement: { querySelector: () => backdrop },
      getBoundingClientRect: () => ({
        left: 250,
        top: 100,
        width: 800,
        height: 600,
      }),
      animate: vi.fn(() => panelAnimation),
    } as unknown as HTMLElement;
    vi.stubGlobal("getComputedStyle", (element: HTMLElement) => ({
      borderRadius: element === card ? "8px" : "12px",
      backgroundColor: element === card ? "rgb(20, 20, 20)" : "rgb(30, 30, 30)",
      boxShadow: "none",
    }));
    vi.stubGlobal("document", {
      body,
      createElement: () => preview,
    });

    const morph = startAssetModalMorph("open", card, modal);
    expect(morph).toBeDefined();
    expect(card.style.visibility).toBe("hidden");
    expect(modal.animate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          top: "40px",
          left: "30px",
          width: "200px",
          height: "120px",
        }),
        expect.objectContaining({
          top: "100px",
          left: "250px",
          width: "800px",
          height: "600px",
        }),
      ]),
      expect.objectContaining({ fill: "both" }),
    );
    expect(body.append).toHaveBeenCalledWith(preview);

    await morph?.finished;
    expect(card.style.visibility).toBe("hidden");
    expect(modal.dataset.assetMorphing).toBeUndefined();
    expect(panelAnimation.cancel).toHaveBeenCalledOnce();
    expect(previewAnimation.cancel).toHaveBeenCalledOnce();
    expect(preview.remove).toHaveBeenCalledOnce();
    expect(backdropAnimation.cancel).toHaveBeenCalledOnce();
  });

  it("reveals the real card before removing the closing preview", async () => {
    const animation = () => ({ finished: Promise.resolve(), cancel: vi.fn() });
    const card = {
      style: { visibility: "hidden" },
      querySelector: () => null,
      cloneNode: () => ({
        style: {},
        removeAttribute: vi.fn(),
        querySelectorAll: () => [],
      }),
      getBoundingClientRect: () => ({
        left: 30,
        top: 40,
        width: 200,
        height: 120,
      }),
    } as unknown as HTMLElement;
    const preview = {
      dataset: {},
      style: {},
      setAttribute: vi.fn(),
      append: vi.fn(),
      animate: vi.fn(animation),
      remove: vi.fn(() => {
        expect(card.style.visibility).toBe("");
      }),
    };
    const modal = {
      dataset: {},
      style: { cssText: "" },
      querySelector: () => null,
      parentElement: { querySelector: () => null },
      getBoundingClientRect: () => ({
        left: 250,
        top: 100,
        width: 800,
        height: 600,
      }),
      animate: vi.fn(animation),
    } as unknown as HTMLElement;
    vi.stubGlobal("getComputedStyle", () => ({
      borderRadius: "8px",
      backgroundColor: "rgb(20, 20, 20)",
      boxShadow: "none",
    }));
    vi.stubGlobal("document", {
      body: { append: vi.fn() },
      createElement: () => preview,
      querySelector: () => null,
    });

    const morph = startAssetModalMorph("close", card, modal, "");
    await morph?.finished;
    expect(preview.remove).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "video thumbnail",
      cardHeight: 90,
      modalHeight: 360,
      cardRadius: "8px",
      modalRadius: "8px",
    },
    {
      name: "color swatch",
      cardHeight: 160,
      modalHeight: 160,
      cardRadius: "2px",
      modalRadius: "12px",
    },
  ])(
    "carries a $name into the modal hero area",
    async ({ name, cardHeight, modalHeight, cardRadius, modalRadius }) => {
      const animation = () => ({
        finished: Promise.resolve(),
        cancel: vi.fn(),
      });
      const panelAnimation = animation();
      const previewAnimation = animation();
      const heroAnimation = animation();
      const modalHeroAnimation = animation();
      const clone = () => ({
        style: {},
        removeAttribute: vi.fn(),
        querySelectorAll: () => [],
      });
      const cardHero = {
        dataset: {
          assetCardHero: name === "color swatch" ? "color" : "video",
        },
        offsetWidth: 160,
        offsetHeight: cardHeight,
        cloneNode: clone,
        getBoundingClientRect: () => ({
          left: 32,
          top: 48,
          width: 160,
          height: cardHeight,
        }),
      };
      const clonedHero = { style: {} };
      const cardClone = {
        ...clone(),
        querySelector: () => clonedHero,
      };
      const cardSurface = {
        offsetWidth: 200,
        offsetHeight: 150,
        cloneNode: () => cardClone,
        querySelector: () => cardHero,
        getBoundingClientRect: () => ({
          left: 20,
          top: 20,
          width: 200,
          height: 150,
        }),
      };
      const card = {
        style: { visibility: "", opacity: "", pointerEvents: "" },
        querySelector: vi.fn(() => cardSurface),
        animate: vi.fn(animation),
      } as unknown as HTMLElement;
      const modalHero = {
        getBoundingClientRect: () => ({
          left: 290,
          top: 190,
          width: 640,
          height: modalHeight,
        }),
        animate: vi.fn(() => modalHeroAnimation),
      };
      const preview = {
        dataset: {},
        style: {},
        setAttribute: vi.fn(),
        append: vi.fn(),
        animate: vi.fn(() => previewAnimation),
        remove: vi.fn(),
      };
      const heroPreview = {
        dataset: {},
        style: {},
        setAttribute: vi.fn(),
        append: vi.fn(),
        animate: vi.fn(() => heroAnimation),
        remove: vi.fn(),
      };
      const modal = {
        dataset: {},
        style: { cssText: "" },
        querySelector: () => modalHero,
        parentElement: { querySelector: () => null },
        getBoundingClientRect: () => ({
          left: 200,
          top: 100,
          width: 800,
          height: 600,
        }),
        animate: vi.fn(() => panelAnimation),
      } as unknown as HTMLElement;
      vi.stubGlobal("getComputedStyle", (element: HTMLElement) => ({
        borderRadius:
          element === (cardHero as unknown as HTMLElement)
            ? cardRadius
            : element === (modalHero as unknown as HTMLElement)
              ? modalRadius
              : "8px",
        backgroundColor: "rgb(20, 20, 20)",
        boxShadow: "none",
      }));
      vi.stubGlobal("document", {
        body: { append: vi.fn() },
        createElement: vi
          .fn()
          .mockReturnValueOnce(preview)
          .mockReturnValueOnce(heroPreview)
          .mockReturnValueOnce(preview)
          .mockReturnValueOnce(heroPreview),
        querySelector: () => null,
      });

      const morph = startAssetModalMorph("open", card, modal);
      expect(morph).toBeDefined();
      expect(card.querySelector).toHaveBeenCalledWith(
        "[data-asset-card-surface]",
      );
      expect(clonedHero.style).toEqual({ visibility: "hidden" });
      if (name === "color swatch") {
        expect(preview.animate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ opacity: 0, offset: 0.6 }),
          ]),
          expect.objectContaining({ fill: "both" }),
        );
        expect(heroPreview.animate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ opacity: 1, offset: 0 }),
            expect.objectContaining({ opacity: 1, offset: 1 }),
          ]),
          expect.objectContaining({ fill: "both" }),
        );
        expect(modalHero.animate).toHaveBeenCalledWith(
          [{ opacity: 0 }, { opacity: 0 }],
          expect.objectContaining({ fill: "both" }),
        );
      }
      if (name === "video thumbnail") {
        expect(heroPreview.animate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ opacity: 1, offset: 1 }),
          ]),
          expect.objectContaining({ fill: "both" }),
        );
        expect(modalHero.animate).toHaveBeenCalledWith(
          [{ opacity: 0 }, { opacity: 0 }],
          expect.objectContaining({ fill: "both" }),
        );
      }
      expect(heroPreview.animate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            top: "48px",
            left: "32px",
            height: `${cardHeight}px`,
            borderRadius: cardRadius,
          }),
          expect.objectContaining({
            top: "190px",
            left: "290px",
            height: `${modalHeight}px`,
            borderRadius: modalRadius,
          }),
        ]),
        expect.objectContaining({ fill: "both" }),
      );
      expect(modalHero.animate).toHaveBeenCalled();

      await morph?.finished;
      expect(card.style.visibility).toBe("hidden");
      expect(heroPreview.remove).toHaveBeenCalledOnce();
      expect(heroAnimation.cancel).toHaveBeenCalledOnce();
      expect(modalHeroAnimation.cancel).toHaveBeenCalledOnce();

      if (name === "color swatch") {
        const closingMorph = startAssetModalMorph("close", card, modal, "");
        expect(closingMorph).toBeDefined();
        expect(card.style.visibility).toBe("");
        expect(card.style.opacity).toBe("0.01");
        expect(card.animate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ opacity: 1, offset: 0.92 }),
          ]),
          expect.objectContaining({ fill: "both" }),
        );
        await closingMorph?.finished;
        expect(card.style.visibility).toBe("");
        expect(card.style.opacity).toBe("");
        expect(card.style.pointerEvents).toBe("");
        expect(preview.remove).toHaveBeenCalledTimes(2);
      }
    },
  );
});
