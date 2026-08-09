import * as Sentry from "@sentry/react";

type ImageDeliveryMetricInput = {
  src: string;
  image: HTMLImageElement;
  loading: "eager" | "lazy";
  decodeDurationMs: number;
  reusedDecodedSource: boolean;
};

type ImageDeliveryFailureInput = Pick<
  ImageDeliveryMetricInput,
  "src" | "loading" | "reusedDecodedSource"
>;

type ImageDeliveryAttributes = Record<string, string | number | boolean>;

export function reportImageDecoded({
  src,
  image,
  loading,
  decodeDurationMs,
  reusedDecodedSource,
}: ImageDeliveryMetricInput): void {
  if (!Sentry.isEnabled()) return;

  const attributes = getImageDeliveryAttributes({
    src,
    loading,
    reusedDecodedSource,
  });
  Sentry.metrics.count("image.delivery.decoded", 1, { attributes });
  Sentry.metrics.distribution(
    "image.delivery.decode_duration",
    Math.round(decodeDurationMs),
    { unit: "millisecond", attributes },
  );

  const resourceTiming = getResourceTiming(src);
  if (resourceTiming) {
    const timingAttributes = {
      ...attributes,
      "image.resource_timing": getResourceTimingState(resourceTiming),
    };
    Sentry.metrics.distribution(
      "image.delivery.resource_duration",
      Math.round(resourceTiming.duration),
      { unit: "millisecond", attributes: timingAttributes },
    );

    if (resourceTiming.transferSize > 0) {
      Sentry.metrics.distribution(
        "image.delivery.transfer_bytes",
        resourceTiming.transferSize,
        { unit: "byte", attributes: timingAttributes },
      );
    }
  }

  const renderedWidth = Math.round(
    image.getBoundingClientRect().width * window.devicePixelRatio,
  );
  if (renderedWidth > 0 && image.naturalWidth > 0) {
    Sentry.metrics.distribution(
      "image.delivery.intrinsic_to_rendered_width",
      Number((image.naturalWidth / renderedWidth).toFixed(2)),
      { attributes },
    );
  }
}

export function reportImageFailed({
  src,
  loading,
  reusedDecodedSource,
}: ImageDeliveryFailureInput): void {
  if (!Sentry.isEnabled()) return;

  Sentry.metrics.count("image.delivery.failed", 1, {
    attributes: getImageDeliveryAttributes({
      src,
      loading,
      reusedDecodedSource,
    }),
  });
}

function getImageDeliveryAttributes({
  src,
  loading,
  reusedDecodedSource,
}: Pick<
  ImageDeliveryMetricInput,
  "src" | "loading" | "reusedDecodedSource"
>): ImageDeliveryAttributes {
  return {
    "image.delivery_host": getDeliveryHost(src),
    "image.loading": loading,
    "image.rendition": getRendition(src),
    "image.ui_cache": reusedDecodedSource ? "warm" : "cold",
  };
}

function getDeliveryHost(src: string): "media" | "same-origin" | "external" {
  try {
    const url = new URL(src, window.location.href);
    if (url.hostname === "images.styltsou.com") return "media";
    return url.origin === window.location.origin ? "same-origin" : "external";
  } catch {
    return "external";
  }
}

function getRendition(
  src: string,
): "display" | "preview" | "original" | "other" {
  try {
    const pathname = new URL(src, window.location.href).pathname;
    if (pathname.endsWith("/display.webp")) return "display";
    if (pathname.endsWith("/preview.webp")) return "preview";
    if (/\/original\.[a-z0-9]+$/i.test(pathname)) return "original";
  } catch {
    // Record malformed or non-URL image sources without exposing their value.
  }

  return "other";
}

function getResourceTiming(src: string): PerformanceResourceTiming | undefined {
  const entries = performance.getEntriesByName(src, "resource");
  const latestEntry = entries[entries.length - 1];
  return latestEntry instanceof PerformanceResourceTiming
    ? latestEntry
    : undefined;
}

function getResourceTimingState(
  timing: PerformanceResourceTiming,
): "network" | "browser-cache" | "restricted" {
  if (timing.transferSize > 0) return "network";
  if (timing.encodedBodySize > 0) return "browser-cache";
  return "restricted";
}
