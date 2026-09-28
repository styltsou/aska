import { ApiError } from "@/lib/api";
import { parseWorkspaceAssetPath } from "@/lib/workspace-asset-url";

const ASSET_NAMES: Record<string, string> = {
  image: "image",
  note: "note",
  link: "link",
  color: "color",
};

export function getRootErrorContent(error: unknown, pathname: string) {
  const { assetId, boardPathname } = parseWorkspaceAssetPath(pathname);
  const assetName = assetId ? ASSET_NAMES[assetId.split("-", 1)[0]] : undefined;
  const subject = assetName ? `this ${assetName}` : "this page";
  const loadFailure = error instanceof ApiError;

  let description: string;
  if (loadFailure && error.status === 401) {
    description = "Your session may have expired. Sign in again to continue.";
  } else if (loadFailure && error.status === 403) {
    description = `You may not have access to ${subject}.`;
  } else if (loadFailure && error.status === 404) {
    description = `${assetName ? "This item" : "This page"} may have been moved or deleted.`;
  } else if (loadFailure) {
    description = `We couldn't load ${subject} right now. Please try again.`;
  } else {
    description = `Something went wrong while showing ${subject}. You can try again or go back.`;
  }

  return {
    title: loadFailure
      ? `Couldn't load ${subject}`
      : `${assetName ? `This ${assetName} view` : "This page"} hit a problem`,
    description,
    backPath: assetId ? boardPathname : "/",
    backLabel: assetId ? "Back to board" : "Go to workspace",
    signIn: loadFailure && error.status === 401,
  };
}

export function formatRootErrorDetails(
  error: unknown,
  pathname: string,
  timestamp: string,
) {
  const parts = [`Page: ${pathname}`, `Time: ${timestamp}`];

  if (error instanceof Error) {
    parts.push(`Error: ${error.name}: ${error.message}`);
    if (error.stack) parts.push(`Stack:\n${error.stack}`);
  } else {
    parts.push(`Error: ${String(error)}`);
  }

  return parts.join("\n");
}
