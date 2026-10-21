import { browser, defineBackground } from "#imports";
import { CAPTURE_COLOR_PICKER } from "../lib/color-picker";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== CAPTURE_COLOR_PICKER) return false;

    const tab = sender.tab;
    if (tab?.id == null || tab.windowId == null) {
      sendResponse({ ok: false, error: "No page is available to capture." });
      return false;
    }

    void (async () => {
      try {
        const [before] = await browser.tabs.query({
          active: true,
          windowId: tab.windowId,
        });
        if (before?.id !== tab.id) {
          throw new Error("The active tab changed. Please try again.");
        }

        const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
        });
        const [after] = await browser.tabs.query({
          active: true,
          windowId: tab.windowId,
        });
        if (after?.id !== tab.id) {
          throw new Error("The active tab changed. Please try again.");
        }

        sendResponse({ ok: true, dataUrl });
      } catch (error) {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "The page could not be captured.",
        });
      }
    })();

    return true;
  });
});
