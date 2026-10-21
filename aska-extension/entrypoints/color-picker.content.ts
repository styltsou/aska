import {
  browser,
  createShadowRootUi,
  defineContentScript,
} from "#imports";
import {
  CAPTURE_COLOR_PICKER,
  PENDING_COLOR_KEY,
  START_COLOR_PICKER,
  colorFormats,
  rgbToHex,
  type PendingColor,
} from "../lib/color-picker";

import "./color-picker.css";

interface CaptureReply {
  ok: boolean;
  dataUrl?: string;
  error?: string;
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  cssInjectionMode: "ui",

  main(ctx) {
    let activeUi: { remove: () => void } | null = null;
    let starting = false;

    const stop = () => {
      activeUi?.remove();
      activeUi = null;
      window.dispatchEvent(new Event("aska:color-picker-stop"));
    };

    const start = async () => {
      if (starting || activeUi) return;
      starting = true;
      window.dispatchEvent(new Event("aska:color-picker-start"));

      try {
        // Let other extension overlays disappear before taking the snapshot.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        const reply = (await browser.runtime.sendMessage({
          type: CAPTURE_COLOR_PICKER,
        })) as CaptureReply;
        if (!reply?.ok || !reply.dataUrl) {
          throw new Error(reply?.error ?? "The page could not be captured.");
        }

        const image = new Image();
        image.src = reply.dataUrl;
        await image.decode();
        const buffer = document.createElement("canvas");
        buffer.width = image.naturalWidth;
        buffer.height = image.naturalHeight;
        const context = buffer.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("The page image could not be read.");
        context.drawImage(image, 0, 0);

        const ui = await createShadowRootUi(ctx, {
          name: "aska-color-picker",
          position: "modal",
          zIndex: 2147483647,
          onMount(container) {
            const root = document.createElement("div");
            root.className = "aska-picker";
            root.innerHTML = [
              '<canvas aria-hidden="true" class="aska-picker__snapshot"></canvas>',
              '<div class="aska-picker__surface"></div>',
              '<div class="aska-picker__hint">Pick a color <span>·</span> Click to select <kbd>Esc</kbd> to cancel</div>',
              '<button class="aska-picker__cancel" type="button">Cancel</button>',
              '<div class="aska-picker__preview is-hidden">',
              '  <span class="aska-picker__swatch"></span>',
              '  <span class="aska-picker__values"><strong></strong><small></small><small></small></span>',
              '</div>',
              '<div class="aska-picker__result-backdrop is-hidden">',
              '  <div class="aska-picker__result" role="dialog" aria-modal="true" aria-label="Selected color">',
              '    <span class="aska-picker__result-swatch"></span>',
              '    <span class="aska-picker__result-kicker">COLOR READY</span>',
              '    <strong class="aska-picker__result-hex"></strong>',
              '    <span class="aska-picker__result-formats"></span>',
              '    <p>Ready in the Aska extension for saving when your account is connected.</p>',
              '    <div class="aska-picker__result-actions">',
              '      <button class="aska-picker__copy" type="button">Copy HEX</button>',
              '      <button class="aska-picker__done" type="button">Done</button>',
              '    </div>',
              '  </div>',
              '</div>',
              '<div class="aska-picker__error is-hidden" role="alert"></div>',
            ].join("");
            container.append(root);

            const visual = root.querySelector<HTMLCanvasElement>(
              ".aska-picker__snapshot",
            )!;
            visual.width = buffer.width;
            visual.height = buffer.height;
            visual.getContext("2d")?.drawImage(buffer, 0, 0);

            const surface = root.querySelector<HTMLElement>(
              ".aska-picker__surface",
            )!;
            const preview = root.querySelector<HTMLElement>(
              ".aska-picker__preview",
            )!;
            const swatch = root.querySelector<HTMLElement>(
              ".aska-picker__swatch",
            )!;
            const values = preview.querySelectorAll<HTMLElement>(
              ".aska-picker__values > *",
            );
            const result = root.querySelector<HTMLElement>(
              ".aska-picker__result-backdrop",
            )!;
            const errorBox = root.querySelector<HTMLElement>(
              ".aska-picker__error",
            )!;
            let selected: PendingColor | null = null;
            let latestPointer: { x: number; y: number } | null = null;
            let frame: number | null = null;
            let saving = false;

            const sampleAt = (clientX: number, clientY: number) => {
              const rect = root.getBoundingClientRect();
              if (!rect.width || !rect.height) return null;
              const x = Math.min(
                buffer.width - 1,
                Math.max(
                  0,
                  Math.floor(((clientX - rect.left) / rect.width) * buffer.width),
                ),
              );
              const y = Math.min(
                buffer.height - 1,
                Math.max(
                  0,
                  Math.floor(((clientY - rect.top) / rect.height) * buffer.height),
                ),
              );
              const pixel = context.getImageData(x, y, 1, 1).data;
              const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
              return { hex, ...colorFormats(hex) };
            };

            const showError = (message: string) => {
              errorBox.textContent = message;
              errorBox.classList.remove("is-hidden");
            };

            const updatePreview = (clientX: number, clientY: number) => {
              const color = sampleAt(clientX, clientY);
              if (!color) return;
              preview.classList.remove("is-hidden");
              swatch.style.backgroundColor = color.hex;
              values[0].textContent = color.hex.toUpperCase();
              values[1].textContent = color.rgb;
              values[2].textContent = color.hsl;
              const width = preview.offsetWidth;
              const height = preview.offsetHeight;
              const preferredX =
                clientX + width + 20 > window.innerWidth
                  ? clientX - width - 20
                  : clientX + 20;
              const preferredY =
                clientY - height - 18 < 12
                  ? clientY + 20
                  : clientY - height - 18;
              const left = Math.max(
                12,
                Math.min(window.innerWidth - width - 12, preferredX),
              );
              const top = Math.max(
                12,
                Math.min(window.innerHeight - height - 12, preferredY),
              );
              preview.style.transform =
                "translate3d(" + left + "px, " + top + "px, 0)";
            };

            const onPointerMove = (event: PointerEvent) => {
              latestPointer = { x: event.clientX, y: event.clientY };
              if (frame !== null) return;
              frame = requestAnimationFrame(() => {
                frame = null;
                if (latestPointer && !selected) {
                  updatePreview(latestPointer.x, latestPointer.y);
                }
              });
            };

            const onSelect = async (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              if (selected || saving) return;
              const color = sampleAt(event.clientX, event.clientY);
              if (!color) return;
              saving = true;
              try {
                selected = {
                  hex: color.hex,
                  pickedAt: new Date().toISOString(),
                };
                await browser.storage.local.set({
                  [PENDING_COLOR_KEY]: selected,
                });
                surface.classList.add("is-hidden");
                preview.classList.add("is-hidden");
                result.classList.remove("is-hidden");
                root.querySelector<HTMLElement>(
                  ".aska-picker__result-swatch",
                )!.style.backgroundColor = color.hex;
                root.querySelector<HTMLElement>(
                  ".aska-picker__result-hex",
                )!.textContent = color.hex.toUpperCase();
                root.querySelector<HTMLElement>(
                  ".aska-picker__result-formats",
                )!.textContent = color.rgb + " · " + color.hsl;
              } catch {
                selected = null;
                showError("Could not keep this color. Please try again.");
              } finally {
                saving = false;
              }
            };

            const onCopy = async () => {
              if (!selected) return;
              try {
                await navigator.clipboard.writeText(selected.hex.toUpperCase());
                root.querySelector<HTMLElement>(
                  ".aska-picker__copy",
                )!.textContent = "Copied";
              } catch {
                showError("Could not copy the color.");
              }
            };

            const onKey = (event: KeyboardEvent) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                stop();
              } else if (
                [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(
                  event.key,
                )
              ) {
                event.preventDefault();
              }
            };
            const blockScroll = (event: Event) => event.preventDefault();

            surface.addEventListener("pointermove", onPointerMove);
            surface.addEventListener("click", onSelect);
            root.querySelector(".aska-picker__cancel")!.addEventListener(
              "click",
              stop,
            );
            root.querySelector(".aska-picker__done")!.addEventListener(
              "click",
              stop,
            );
            root.querySelector(".aska-picker__copy")!.addEventListener(
              "click",
              onCopy,
            );
            document.addEventListener("keydown", onKey, true);
            document.addEventListener("wheel", blockScroll, {
              capture: true,
              passive: false,
            });
            document.addEventListener("touchmove", blockScroll, {
              capture: true,
              passive: false,
            });
            window.addEventListener("scroll", stop, true);
            window.addEventListener("resize", stop);

            return () => {
              if (frame !== null) cancelAnimationFrame(frame);
              document.removeEventListener("keydown", onKey, true);
              document.removeEventListener("wheel", blockScroll, true);
              document.removeEventListener("touchmove", blockScroll, true);
              window.removeEventListener("scroll", stop, true);
              window.removeEventListener("resize", stop);
            };
          },
          onRemove(cleanup) {
            cleanup?.();
          },
        });
        activeUi = ui;
        ui.mount();
      } catch (error) {
        stop();
        throw error;
      } finally {
        starting = false;
      }
    };

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== START_COLOR_PICKER) return false;
      void start().then(
        () => sendResponse({ ok: true }),
        (error) =>
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Color picking could not start on this page.",
          }),
      );
      return true;
    });
  },
});
