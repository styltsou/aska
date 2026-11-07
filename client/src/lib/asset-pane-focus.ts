let activePane: "main" | "peek" = "main";

export function setActiveAssetPane(pane: "main" | "peek") {
  activePane = pane;
}

export function isPeekAssetPaneActive() {
  return activePane === "peek";
}
