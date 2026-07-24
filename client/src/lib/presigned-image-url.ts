const MAX_CACHED_IMAGE_SOURCES = 500;
const EXPIRY_SAFETY_WINDOW_MS = 60_000;

type CachedImageSource = {
  src: string;
  expiresAt: number;
};

const cachedImageSources = new Map<string, CachedImageSource>();

/**
 * Keeps a still-valid S3 presigned URL stable across API refetches. A new
 * signature is a different browser cache key even when it points to the same
 * immutable object, so replacing it makes the browser fetch and decode again.
 */
export function resolvePresignedImageUrl(
  src: string,
  now = Date.now(),
): string {
  const incoming = parsePresignedImageUrl(src);
  if (!incoming) return src;

  const cached = cachedImageSources.get(incoming.cacheKey);
  if (cached && cached.expiresAt > now + EXPIRY_SAFETY_WINDOW_MS) {
    return cached.src;
  }

  return src;
}

export function rememberPresignedImageUrl(src: string, now = Date.now()) {
  const incoming = parsePresignedImageUrl(src);
  if (!incoming) return;

  const cached = cachedImageSources.get(incoming.cacheKey);
  if (cached && cached.expiresAt > now + EXPIRY_SAFETY_WINDOW_MS) {
    touch(incoming.cacheKey, cached);
    return;
  }

  touch(incoming.cacheKey, { src, expiresAt: incoming.expiresAt });
}

function parsePresignedImageUrl(src: string): {
  cacheKey: string;
  expiresAt: number;
} | null {
  try {
    const url = new URL(src);
    const issuedAt = parseAmzDate(url.searchParams.get("X-Amz-Date"));
    const expiresInSeconds = Number(url.searchParams.get("X-Amz-Expires"));

    if (
      issuedAt === null ||
      !Number.isFinite(expiresInSeconds) ||
      expiresInSeconds <= 0
    ) {
      return null;
    }

    return {
      // The path is the immutable S3 object identity; the query is only auth.
      cacheKey: `${url.origin}${url.pathname}`,
      expiresAt: issuedAt + expiresInSeconds * 1_000,
    };
  } catch {
    return null;
  }
}

function parseAmzDate(value: string | null): number | null {
  const match = value?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function touch(cacheKey: string, value: CachedImageSource) {
  cachedImageSources.delete(cacheKey);
  cachedImageSources.set(cacheKey, value);

  if (cachedImageSources.size > MAX_CACHED_IMAGE_SOURCES) {
    cachedImageSources.delete(cachedImageSources.keys().next().value!);
  }
}
