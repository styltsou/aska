export const SETTINGS_REQUEST_EVENT = "aska-settings-request";

export function openSettings() {
  window.dispatchEvent(
    new CustomEvent<boolean>(SETTINGS_REQUEST_EVENT, { detail: true }),
  );
}

export function closeSettings() {
  window.dispatchEvent(
    new CustomEvent<boolean>(SETTINGS_REQUEST_EVENT, { detail: false }),
  );
}
