import { AppError, ErrorCode } from "@/lib/errors";

export type AssetNodeIdentifier = {
  assetType: "image" | "note" | "link";
  entityId: number;
};

export type CollectionNodeIdentifier =
  | { nodeType: "folder"; entityId: number }
  | {
      nodeType: "asset";
      assetType: "image" | "note" | "link";
      entityId: number;
    };

const collectionNodeIdPattern = /^(folder|image|note|link)-(\d+)$/;
const assetNodeIdPattern = /^(image|note|link)-(\d+)$/;

/** Parses a public collection-node ID into its persisted target kind and ID. */
export function parseCollectionNodeId(
  nodeId: string,
): CollectionNodeIdentifier {
  const match = collectionNodeIdPattern.exec(nodeId);
  const entityId = match ? Number(match[2]) : NaN;
  if (!match || !Number.isSafeInteger(entityId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid node id");
  }

  if (match[1] === "folder") {
    return { nodeType: "folder", entityId };
  }

  return {
    nodeType: "asset",
    assetType: match[1] as AssetNodeIdentifier["assetType"],
    entityId,
  };
}

/** Restricts Inbox asset operations to persisted asset node identifiers. */
export function parseAssetNodeId(nodeId: string): AssetNodeIdentifier {
  const match = assetNodeIdPattern.exec(nodeId);
  const entityId = match ? Number(match[2]) : NaN;
  if (!match || !Number.isSafeInteger(entityId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid asset id");
  }

  return { assetType: match[1] as AssetNodeIdentifier["assetType"], entityId };
}
