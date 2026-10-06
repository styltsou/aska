import { Parser } from "htmlparser2";

import { safeFetch } from "../../../services/url-unfurl-shared/src/safe-fetch";

const MAX_HTML_BYTES = 1024 * 1024;
const PHOTO_PATH = /^\/photos\/[^/]+\/?$/;
const IMAGE_PATH = /^\/photo-[a-z0-9_-]+$/i;

export type UnsplashPhoto = {
  url: string;
  sourceUrl: string;
  title?: string;
  alt?: string;
};

export function isUnsplashPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "unsplash.com" ||
        url.hostname === "www.unsplash.com") &&
      PHOTO_PATH.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export async function resolveUnsplashPhoto(
  value: string,
): Promise<UnsplashPhoto | null> {
  const response = await safeFetch(value, {
    accept: "text/html,application/xhtml+xml;q=0.9",
    allowedContentTypes: ["text/html", "application/xhtml+xml"],
    maxBytes: MAX_HTML_BYTES,
    totalTimeoutMs: 10_000,
    bodyMode: "html-head",
  });
  if (!isUnsplashPhotoUrl(response.finalUrl)) return null;

  return parseUnsplashPhoto(
    new TextDecoder("utf-8", { fatal: false }).decode(response.body),
    response.finalUrl,
  );
}

/** Selects the photo source from Unsplash's page metadata, avoiding its branded social preview. */
export function parseUnsplashPhoto(
  html: string,
  sourceUrl: string,
): UnsplashPhoto | null {
  if (!isUnsplashPhotoUrl(sourceUrl)) return null;

  const sources: Array<{ url: URL; width: number }> = [];
  const social = { image: null as URL | null };
  let title = "";
  let inTitle = false;
  let inBody = false;

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name === "body") inBody = true;
        if (inBody) return;
        if (name === "title") inTitle = true;
        if (
          name === "link" &&
          attributes.rel === "preload" &&
          attributes.as === "image"
        ) {
          for (const candidate of (attributes.imagesrcset ?? "").split(
            /,\s*(?=https?:\/\/)/,
          )) {
            const match = candidate.trim().match(/^(https?:\/\/\S+)\s+(\d+)w$/);
            if (!match) continue;
            const url = unsplashImageUrl(match[1]);
            if (url) sources.push({ url, width: Number(match[2]) });
          }
          const url = attributes.href && unsplashImageUrl(attributes.href);
          if (url) sources.push({ url, width: 0 });
        }
        if (name === "meta" && attributes.property === "og:image") {
          social.image = unsplashImageUrl(attributes.content);
        }
      },
      ontext(value) {
        if (inTitle) title += value;
      },
      onclosetag(name) {
        if (name === "title") inTitle = false;
      },
    },
    {
      decodeEntities: true,
      lowerCaseAttributeNames: true,
      lowerCaseTags: true,
    },
  );
  parser.write(html);
  parser.end();

  const socialImagePath = social.image?.pathname;
  const matchingSources = socialImagePath
    ? sources.filter(({ url }) => url.pathname === socialImagePath)
    : sources;
  const selected =
    matchingSources
      .sort((a, b) => a.width - b.width)
      .find(({ width }) => width >= 1600) ?? matchingSources.at(-1);
  // A page can omit the preload. Rebuild a clean CDN URL from its social image,
  // retaining the ixid so the source remains traceable to this photo.
  const image =
    selected?.url ?? (social.image ? cleanSocialImage(social.image) : null);
  if (!image) return null;

  const description = title
    .replace(/\s+-\s+(?:Free\s+)?Photo on Unsplash\s*$/i, "")
    .trim()
    .slice(0, 255);

  return {
    url: image.toString(),
    sourceUrl,
    ...(description ? { title: description, alt: description } : {}),
  };
}

function unsplashImageUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "images.unsplash.com" &&
      IMAGE_PATH.test(url.pathname)
      ? url
      : null;
  } catch {
    return null;
  }
}

function cleanSocialImage(socialImage: URL): URL {
  const url = new URL(socialImage.pathname, socialImage.origin);
  const ixid = socialImage.searchParams.get("ixid");
  if (ixid) url.searchParams.set("ixid", ixid);
  url.searchParams.set("w", "1600");
  url.searchParams.set("q", "80");
  url.searchParams.set("auto", "format");
  return url;
}
