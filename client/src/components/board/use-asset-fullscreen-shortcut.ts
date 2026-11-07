import { useEffect, useRef } from "react";
import {
  matchesKeybinding,
  TOGGLE_ASSET_FULLSCREEN_SHORTCUT,
} from "@/lib/keybindings";
import { isPeekAssetPaneActive } from "@/lib/asset-pane-focus";

export function useAssetFullscreenShortcut(
  enabled: boolean,
  toggle: () => void,
) {
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        isPeekAssetPaneActive() ||
        !matchesKeybinding(event, TOGGLE_ASSET_FULLSCREEN_SHORTCUT)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
