const SETTINGS_PARAM = "settings";

function updateUrl(open: boolean) {
  const url = new URL(window.location.href);
  if (open) {
    url.searchParams.set(SETTINGS_PARAM, "true");
  } else {
    url.searchParams.delete(SETTINGS_PARAM);
  }
  window.history.replaceState({}, "", url.toString());
  window.dispatchEvent(new Event("settings-changed"));
}

export function openSettings() {
  updateUrl(true);
}

export function closeSettings() {
  updateUrl(false);
}

export function isSettingsOpen(): boolean {
  return (
    new URLSearchParams(window.location.search).get(SETTINGS_PARAM) === "true"
  );
}
