export function positionResizeGrip(
  handle: HTMLElement,
  grip: HTMLElement | null,
  clientY: number,
  edgeInset = 40,
) {
  if (!grip) return;
  const bounds = handle.getBoundingClientRect();
  const y = Math.min(
    Math.max(clientY - bounds.top, edgeInset),
    bounds.height - edgeInset,
  );
  grip.style.transform = `translateY(${y - bounds.height / 2}px)`;
}
