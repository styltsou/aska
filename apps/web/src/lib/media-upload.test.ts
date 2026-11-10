import { describe, expect, it } from "vitest";

import { MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from "@/constants";
import { isUploadableMediaFile, localMediaKind } from "./media-upload";

function file(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe("mixed media selection", () => {
  it("accepts images and videos in one selection, including videos with missing MIME", () => {
    const files = [
      file("photo.png", "image/png", 100),
      file("clip.mp4", "", 200),
      file("other.webm", "video/webm", 300),
      file("notes.txt", "text/plain", 50),
    ];
    expect(files.filter(isUploadableMediaFile).map(localMediaKind)).toEqual([
      "image",
      "video",
      "video",
    ]);
  });

  it("uses the correct per-type size limit and rejects empty files", () => {
    expect(
      isUploadableMediaFile(
        file("image.jpg", "image/jpeg", MAX_IMAGE_UPLOAD_BYTES),
      ),
    ).toBe(true);
    expect(
      isUploadableMediaFile(
        file("image.jpg", "image/jpeg", MAX_IMAGE_UPLOAD_BYTES + 1),
      ),
    ).toBe(false);
    expect(
      isUploadableMediaFile(
        file("video.mp4", "video/mp4", MAX_VIDEO_UPLOAD_BYTES),
      ),
    ).toBe(true);
    expect(
      isUploadableMediaFile(
        file("video.mp4", "video/mp4", MAX_VIDEO_UPLOAD_BYTES + 1),
      ),
    ).toBe(false);
    expect(isUploadableMediaFile(file("empty.webm", "video/webm", 0))).toBe(
      false,
    );
  });
});
