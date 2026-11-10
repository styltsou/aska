/** Restore CSS positioning after a pixel-based animation without animating the handoff. */
export function restoreStyleWithoutTransition(
  element: HTMLElement,
  previousStyle: string,
) {
  element.style.cssText = previousStyle;
  element.style.transition = "none";
  // Commit the restored geometry before allowing the component's transitions again.
  element.getBoundingClientRect();
  element.style.cssText = previousStyle;
}
