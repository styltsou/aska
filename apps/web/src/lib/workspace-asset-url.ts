const WORKSPACE_ASSET_ID = /^(?:image|video|note|link|color)-\d+$/;
const ASSET_SEGMENT = "asset";

export function parseWorkspaceAssetId(value: unknown): string | undefined {
  return typeof value === "string" && WORKSPACE_ASSET_ID.test(value)
    ? value
    : undefined;
}

export type WorkspaceAssetLocation = {
  boardPathname: string;
  assetId?: string;
};

/** The asset suffix belongs to the board being viewed, not to the asset's own location. */
export function parseWorkspaceAssetPath(
  pathname: string,
): WorkspaceAssetLocation {
  const segments = pathname.split("/").filter(Boolean);
  const suffix = segments.at(-2);
  const assetId = parseWorkspaceAssetId(segments.at(-1));
  if (suffix !== ASSET_SEGMENT || !assetId || segments.length < 3) {
    return { boardPathname: pathname };
  }

  const boardSegments = segments.slice(0, -2);
  const validBoard =
    boardSegments.length === 1 ||
    (boardSegments.length === 2 && boardSegments[1] === "inbox") ||
    (boardSegments.length >= 3 && boardSegments[1] === "collections");
  if (!validBoard) return { boardPathname: pathname };

  return { boardPathname: `/${boardSegments.join("/")}`, assetId };
}

export function workspaceAssetPath(
  boardPathname: string,
  assetId: string,
): string {
  return `${boardPathname.replace(/\/$/, "")}/${ASSET_SEGMENT}/${assetId}`;
}
