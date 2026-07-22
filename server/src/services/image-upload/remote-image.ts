import {
  AllowedImageContentTypes as allowedImageContentTypes,
  type CreateImageUploadInput,
} from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";

const contentTypeExtensions: Record<
  CreateImageUploadInput["contentType"],
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Creates the immutable ingest key while retaining a useful image extension. */
export function makeOriginalObjectKey(
  storageId: string,
  fileName: string,
  contentType: string,
): string {
  return `ingest/${storageId}/original${extensionForImage(fileName, contentType)}`;
}

/** Restricts remote imports to network URLs accepted by the fetch workflow. */
export function parseRemoteImageUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Remote image URL must use HTTP or HTTPS",
    );
  }
  return url;
}

/** Parses an HTTP content-type header into the supported direct-upload union. */
export function normalizeRemoteImageContentType(
  contentTypeHeader: string | null,
): CreateImageUploadInput["contentType"] {
  const contentType = contentTypeHeader?.split(";")[0]?.trim().toLowerCase();
  if (
    !contentType ||
    !allowedImageContentTypes.includes(
      contentType as CreateImageUploadInput["contentType"],
    )
  ) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Remote URL did not return a supported image type",
    );
  }

  return contentType as CreateImageUploadInput["contentType"];
}

/** Uses the remote path filename, with a MIME-derived fallback for root URLs. */
export function fileNameFromRemoteImageUrl(
  url: URL,
  contentType: CreateImageUploadInput["contentType"],
): string {
  const pathName = url.pathname.split("/").filter(Boolean).at(-1);
  if (pathName) return pathName;
  return `remote-image.${contentTypeExtensions[contentType]}`;
}

function extensionForImage(fileName: string, contentType: string): string {
  const fileExt = fileName
    .trim()
    .toLowerCase()
    .match(/\.[a-z0-9]+$/)?.[0];
  if (fileExt && fileExt.length <= 12) {
    return fileExt === ".jpeg" ? ".jpg" : fileExt;
  }

  const extension =
    contentTypeExtensions[contentType as CreateImageUploadInput["contentType"]];
  return extension ? `.${extension}` : "";
}
