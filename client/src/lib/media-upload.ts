import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  SUPPORTED_IMAGE_MIME_TYPE_SET,
} from "@/constants";
import type { BoardInsertionPlacement, CollectionNode } from "@/api/collection";
import { reserveNodePositions } from "@/components/canvas/canvas-node-layout";
import { readUploadImageDimensions } from "@/lib/upload-image-dimensions";
import { inferVideoMime } from "@/lib/video-url";

export function localMediaKind(file: Pick<File, "name" | "type">) {
  if (SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type)) return "image";
  if (inferVideoMime(file)) return "video";
  return null;
}

export function isUploadableMediaFile(file: File) {
  const kind = localMediaKind(file);
  return (
    kind !== null &&
    file.size > 0 &&
    file.size <=
      (kind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES)
  );
}

export async function reserveLocalMediaPositions(
  files: File[],
  existingNodes: CollectionNode[],
  placement?: BoardInsertionPlacement,
) {
  const dimensions = await Promise.all(
    files.map(async (file) => {
      if (localMediaKind(file) === "video") return { width: 16, height: 9 };
      try {
        return await readUploadImageDimensions(file);
      } catch {
        return { width: 1, height: 1 };
      }
    }),
  );
  const nodes = files.map((file, index) => ({
    id: `pending-media-${index}`,
    type: localMediaKind(file),
    ...dimensions[index],
  })) as CollectionNode[];
  return reserveNodePositions(existingNodes, nodes, placement);
}
