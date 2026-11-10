import { SUPPORTED_IMAGE_MIME_TYPE_SET } from "@/constants";
import { extensionFromMimeType, parseHttpUrl } from "@/lib/utils";

export type ClipboardAssetPayload =
  | {
      kind: "image-file";
      file: File;
    }
  | {
      kind: "link-url";
      url: string;
    }
  | {
      kind: "color-hex";
      hex: string;
    }
  | {
      kind: "text-note";
      content: string;
    }
  | {
      kind: "empty";
    };

export function getPreferredClipboardText(
  clipboard: Pick<DataTransfer, "getData">,
): string {
  return clipboard.getData("text/markdown") || clipboard.getData("text/plain");
}

export async function copyImageToClipboard(
  loadImageBlob: () => Promise<Blob>,
): Promise<void> {
  if (
    typeof ClipboardItem === "undefined" ||
    typeof navigator.clipboard?.write !== "function"
  ) {
    throw new Error("Your browser does not support copying images.");
  }

  // Start the clipboard write during the user gesture. Safari can reject writes
  // if the image is fetched before navigator.clipboard.write is called.
  const imageBlob = loadImageBlob().then(toClipboardPng);
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": imageBlob }),
  ]);
}

async function toClipboardPng(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/")) {
    throw new Error("The original asset is not a valid image.");
  }

  if (blob.type === "image/png") {
    return blob;
  }

  const image = await createImageBitmap(blob);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to prepare the image for copying.");
    }

    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error("Unable to prepare the image for copying."));
        }
      }, "image/png");
    });
  } finally {
    image.close();
  }
}

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

  const text = await readPreferredClipboardText(clipboardItem);
  const trimmedText = text.trim();
  if (!trimmedText) {
    return { kind: "empty" };
  }

  const linkUrl = parseHttpUrl(trimmedText);
  if (linkUrl) {
    return {
      kind: "link-url",
      url: linkUrl,
    };
  }

  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmedText)) {
    const raw = trimmedText.slice(1).toLowerCase();
    const expanded =
      raw.length === 3 || raw.length === 4
        ? [...raw].map((digit) => digit + digit).join("")
        : raw;
    return { kind: "color-hex", hex: `#${expanded}` };
  }

  return {
    kind: "text-note",
    content: text,
  };
}

/** Reads a browser-dragged hyperlink without treating arbitrary dropped text as a URL. */
export function getDroppedHttpUrl(
  dataTransfer: Pick<DataTransfer, "getData">,
): string | undefined {
  const uriList = dataTransfer
    .getData("text/uri-list")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  return (
    parseHttpUrl(uriList ?? dataTransfer.getData("text/plain")) ?? undefined
  );
}

async function readFirstClipboardItem(): Promise<ClipboardItem | undefined> {
  if (typeof navigator.clipboard.read !== "function") {
    return undefined;
  }

  const items = await navigator.clipboard.read().catch(() => []);
  return items[0];
}

async function readPreferredClipboardText(
  clipboardItem: ClipboardItem | undefined,
): Promise<string> {
  const markdownType = clipboardItem?.types.find(
    (type) => type.toLowerCase().split(";", 1)[0] === "text/markdown",
  );
  if (markdownType) {
    const markdown = await clipboardItem!.getType(markdownType);
    const text = await markdown.text();
    if (text) return text;
  }

  return navigator.clipboard.readText();
}
