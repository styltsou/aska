import { Parser } from "htmlparser2";

type Candidate = { value: string; source: string };

export type ParsedHtmlMetadata = {
  title: Candidate | undefined;
  description: Candidate | undefined;
  siteName: Candidate | undefined;
  canonicalUrl: Candidate | undefined;
  previewUrl: Candidate | undefined;
  previewAlt: string | undefined;
  faviconUrl: Candidate | undefined;
  resourceKind: Candidate | undefined;
};

export function parseHtmlMetadata(html: string): ParsedHtmlMetadata {
  const meta = new Map<string, string>();
  const links: Array<Record<string, string>> = [];
  let inTitle = false;
  let inBody = false;
  let titleText = "";

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name === "body") inBody = true;
        if (inBody) return;
        if (name === "title") inTitle = true;
        if (name === "meta") {
          const key = (attributes.property || attributes.name || "")
            .trim()
            .toLowerCase();
          const value = clean(attributes.content, 2_000);
          if (key && value && !meta.has(key)) meta.set(key, value);
        }
        if (name === "link") links.push(lowercaseAttributes(attributes));
      },
      ontext(value) {
        if (inTitle) titleText += value;
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

  const ogTitle = clean(meta.get("og:title"), 255);
  const twitterTitle = clean(meta.get("twitter:title"), 255);
  const standardTitle = clean(titleText, 255);
  const ogDescription = clean(meta.get("og:description"), 2_000);
  const twitterDescription = clean(meta.get("twitter:description"), 2_000);
  const standardDescription = clean(meta.get("description"), 2_000);
  const ogSiteName = clean(meta.get("og:site_name"), 255);
  const applicationName = clean(meta.get("application-name"), 255);
  const ogImage = clean(
    meta.get("og:image:secure_url") || meta.get("og:image"),
    4_096,
  );
  const twitterImage = clean(
    meta.get("twitter:image") || meta.get("twitter:image:src"),
    4_096,
  );
  const canonical = links.find((link) =>
    relTokens(link.rel).has("canonical"),
  )?.href;
  const favicon = links
    .filter((link) => {
      const rel = relTokens(link.rel);
      return (
        rel.has("icon") ||
        rel.has("shortcut icon") ||
        rel.has("apple-touch-icon")
      );
    })
    .sort((a, b) => iconScore(b) - iconScore(a))[0]?.href;
  const ogType = clean(meta.get("og:type"), 64);

  return {
    title:
      candidate(ogTitle, "og:title") ??
      candidate(twitterTitle, "twitter:title") ??
      candidate(standardTitle, "html:title"),
    description:
      candidate(ogDescription, "og:description") ??
      candidate(twitterDescription, "twitter:description") ??
      candidate(standardDescription, "meta:description"),
    siteName:
      candidate(ogSiteName, "og:site_name") ??
      candidate(applicationName, "meta:application-name"),
    canonicalUrl: candidate(clean(canonical, 4_096), "link:canonical"),
    previewUrl:
      candidate(
        ogImage,
        meta.has("og:image:secure_url") ? "og:image:secure_url" : "og:image",
      ) ?? candidate(twitterImage, "twitter:image"),
    previewAlt: clean(
      meta.get("og:image:alt") || meta.get("twitter:image:alt"),
      1_000,
    ),
    faviconUrl: candidate(clean(favicon, 4_096), "link:icon"),
    resourceKind: candidate(
      ogType === "article" ? "article" : undefined,
      "og:type",
    ),
  };
}

function candidate(
  value: string | undefined,
  source: string,
): Candidate | undefined {
  return value ? { value, source } : undefined;
}

function clean(value: string | undefined, max: number): string | undefined {
  const normalized = value
    ?.replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function lowercaseAttributes(input: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function relTokens(value: string | undefined): Set<string> {
  const normalized = value?.trim().toLowerCase() ?? "";
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  if (normalized === "shortcut icon") tokens.add("shortcut icon");
  return tokens;
}

function iconScore(link: Record<string, string>): number {
  const sizes = link.sizes?.match(/(\d+)x(\d+)/i);
  return sizes ? Number(sizes[1]) * Number(sizes[2]) : 0;
}
