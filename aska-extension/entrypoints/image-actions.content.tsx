import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import "./image-actions.css";

function ImageAction({
  onLeave,
  onEnter,
}: {
  onLeave: () => void;
  onEnter: () => void;
}) {
  const [message, setMessage] = useState("");

  return (
    <div className="aska-image-action">
      <button
        aria-label="Save image to Aska"
        className="aska-image-action__button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMessage(
            "Image saving will be available after you connect your Aska account.",
          );
        }}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M6.75 4.75h10.5a1.5 1.5 0 0 1 1.5 1.5v13l-6.75-3.5-6.75 3.5v-13a1.5 1.5 0 0 1 1.5-1.5Z" />
          <path d="M12 7.5v5m-2.5-2.5h5" />
        </svg>
        <span>Save to Aska</span>
      </button>
      {message ? (
        <p aria-live="polite" className="aska-image-action__message">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    let activeImage: HTMLImageElement | undefined;
    let activeUi: { remove: () => void } | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    let pickerActive = false;

    window.addEventListener("aska:color-picker-start", () => {
      pickerActive = true;
      generation += 1;
      if (closeTimer) clearTimeout(closeTimer);
      activeUi?.remove();
      activeUi = undefined;
      activeImage = undefined;
    });
    window.addEventListener("aska:color-picker-stop", () => {
      pickerActive = false;
    });

    const closeSoon = () => {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        generation += 1;
        activeUi?.remove();
        activeUi = undefined;
        activeImage = undefined;
      }, 180);
    };

    const showForImage = async (image: HTMLImageElement) => {
      if (pickerActive) return;
      if (closeTimer) clearTimeout(closeTimer);
      if (activeImage === image && activeUi) return;

      const nextGeneration = ++generation;
      activeUi?.remove();
      activeUi = undefined;
      activeImage = image;

      const ui = await createShadowRootUi(ctx, {
        name: "aska-image-action",
        position: "overlay",
        alignment: "top-right",
        anchor: image,
        zIndex: 2147483647,
        onMount(container) {
          const root: Root = createRoot(container);
          root.render(
            <ImageAction onEnter={() => {
              if (closeTimer) clearTimeout(closeTimer);
            }} onLeave={closeSoon} />,
          );
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      });

      if (generation !== nextGeneration || !image.isConnected) {
        ui.remove();
        return;
      }

      activeUi = ui;
      ui.mount();
    };

    ctx.addEventListener(
      document,
      "pointerover",
      (event) => {
        if (pickerActive) return;
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return;

        const bounds = target.getBoundingClientRect();
        if (bounds.width < 80 || bounds.height < 60 || !target.currentSrc) return;
        void showForImage(target);
      },
      true,
    );

    ctx.addEventListener(
      document,
      "pointerout",
      (event) => {
        if (event.target === activeImage) closeSoon();
      },
      true,
    );
  },
});
