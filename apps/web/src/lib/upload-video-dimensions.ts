/** Read the dimensions before the dropped video has a server asset ID. */
export function readUploadVideoDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const finish = (dimensions?: { width: number; height: number }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (dimensions) resolve(dimensions);
      else reject(new Error("Unable to read video dimensions"));
    };
    const timeout = window.setTimeout(() => finish(), 10_000);
    video.addEventListener(
      "loadedmetadata",
      () =>
        finish(
          video.videoWidth > 0 && video.videoHeight > 0
            ? { width: video.videoWidth, height: video.videoHeight }
            : undefined,
        ),
      { once: true },
    );
    video.addEventListener("error", () => finish(), { once: true });
    video.src = url;
    video.load();
  });
}
