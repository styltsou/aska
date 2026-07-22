import { AppError, ErrorCode } from "@/lib/errors";

export type AssetNodeIdentifier = {
  assetType: "image" | "note";
  entityId: number;
};

export type CollectionNodeIdentifier =
  | { nodeType: "folder"; entityId: number }
  | { nodeType: "asset"; entityId: number };

const collectionNodeIdPattern = /^(folder|image|note)-(\d+)$/;
const assetNodeIdPattern = /^(image|note)-(\d+)$/;

/** Parses a public collection-node ID into its persisted target kind and ID. */
export function parseCollectionNodeId(
  nodeId: string,
): CollectionNodeIdentifier {
  const match = collectionNodeIdPattern.exec(nodeId);
  const entityId = match ? Number(match[2]) : NaN;
  if (!match || !Number.isSafeInteger(entityId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid node id");
  }

  return {
    nodeType: match[1] === "folder" ? "folder" : "asset",
    entityId,
  };
}

/** Restricts Inbox asset operations to image and note node identifiers. */
export function parseAssetNodeId(nodeId: string): AssetNodeIdentifier {
  const match = assetNodeIdPattern.exec(nodeId);
  const entityId = match ? Number(match[2]) : NaN;
  if (!match || !Number.isSafeInteger(entityId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid asset id");
  }

  return { assetType: match[1] as AssetNodeIdentifier["assetType"], entityId };
}
