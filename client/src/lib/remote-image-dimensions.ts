export type RemoteImageDimensions = {
  width: number;
  height: number;
};

const REMOTE_IMAGE_DIMENSIONS_TIMEOUT_MS = 10_000;

export function readRemoteImageDimensions(
  url: string,
): Promise<RemoteImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      cleanup();
      image.src = "";
      reject(new Error("Timed out while reading remote image dimensions"));
    }, REMOTE_IMAGE_DIMENSIONS_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    }

    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      cleanup();
      if (width > 0 && height > 0) {
        resolve({ width, height });
      } else {
        reject(new Error("Remote image has no readable dimensions"));
      }
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Unable to load remote image preview"));
    };
    image.decoding = "async";
    image.src = url;
  });
}
