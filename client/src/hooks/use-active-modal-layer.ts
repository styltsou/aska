import { useEffect, useState } from "react";

const MODAL_LAYER_SELECTOR = [
  '[data-slot="alert-dialog-content"]',
  '[data-slot="dialog-content"]',
  '[data-slot="drawer-popup"]',
  '[data-slot="sheet-content"]',
].join(",");

function hasActiveModalLayer() {
  return document.querySelector(MODAL_LAYER_SELECTOR) !== null;
}

export function useActiveModalLayer() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const updateActive = () => setActive(hasActiveModalLayer());
    const observer = new MutationObserver(updateActive);

    updateActive();
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return active;
}
