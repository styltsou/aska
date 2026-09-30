import {
  AllowedImageContentTypes,
  AllowedVideoContentTypes,
} from "@/dto/upload.dto";

export function classifyMediaContentType(
  contentType: string,
): "image" | "video" | null {
  if (AllowedImageContentTypes.some((type) => type === contentType))
    return "image";
  if (AllowedVideoContentTypes.some((type) => type === contentType))
    return "video";
  return null;
}
