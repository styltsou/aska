import { SUPPORTED_IMAGE_MIME_TYPE_SET } from "@/constants";
import { extensionFromMimeType, parseHttpUrl } from "@/lib/utils";

export type ClipboardAssetPayload =
  | {
      kind: "image-file";
      file: File;
    }
  | {
      kind: "remote-image-url";
      url: string;
    }
  | {
      kind: "text-note";
      content: string;
    }
  | {
      kind: "empty";
    };

export async function readClipboardAssetPayload(): Promise<ClipboardAssetPayload> {
  const clipboardItem = await readFirstClipboardItem();

  if (clipboardItem) {
    const imageType = clipboardItem.types.find((type) =>
      SUPPORTED_IMAGE_MIME_TYPE_SET.has(type),
    );
    if (imageType) {
      const blob = await clipboardItem.getType(imageType);
      return {
        kind: "image-file",
        file: new File(
          [blob],
          `clipboard-image.${extensionFromMimeType(blob.type)}`,
          { type: blob.type },
        ),
      };
    }
  }

  const text = (await navigator.clipboard.readText()).trim();
  if (!text) {
    return { kind: "empty" };
  }

  const imageUrl = parseHttpUrl(text);
  if (imageUrl) {
    return {
      kind: "remote-image-url",
      url: imageUrl,
    };
  }

  return {
    kind: "text-note",
    content: text,
  };
}

async function readFirstClipboardItem(): Promise<ClipboardItem | undefined> {
  if (typeof navigator.clipboard.read !== "function") {
    return undefined;
  }

  const items = await navigator.clipboard.read().catch(() => []);
  return items[0];
}
