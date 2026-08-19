import { safeFetch } from "../../url-unfurl-shared/src/safe-fetch";
import { parseHtmlMetadata } from "./html-metadata";
import type { ResolverResult, UrlResolver } from "./types";

const MAX_HTML_BYTES = 1024 * 1024;

export class GenericHtmlResolver implements UrlResolver {
  readonly key = "generic-html";
  readonly version = "1";

  matches(): boolean {
    return true;
  }

  async resolve(url: URL): Promise<ResolverResult> {
    const response = await safeFetch(url, {
      accept: "text/html,application/xhtml+xml;q=0.9",
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
      maxBytes: MAX_HTML_BYTES,
      totalTimeoutMs: 10_000,
    });
    const finalUrl = new URL(response.finalUrl);
    const metadata = parseHtmlMetadata(
      new TextDecoder("utf-8", { fatal: false }).decode(response.body),
    );
    const title = metadata.title?.value ?? fallbackTitle(finalUrl);
    const siteName = metadata.siteName?.value ?? finalUrl.hostname;
    const canonicalUrl = safeMetadataUrl(
      metadata.canonicalUrl?.value,
      finalUrl,
    );
    const previewUrl = safeMetadataUrl(metadata.previewUrl?.value, finalUrl);
    const faviconUrl =
      safeMetadataUrl(metadata.faviconUrl?.value, finalUrl) ??
      new URL("/favicon.ico", finalUrl).toString();
    const provenance: ResolverResult["fieldProvenance"] = {
      title: {
        resolver: this.key,
        source: metadata.title?.source ?? "url:fallback",
      },
      siteName: {
        resolver: this.key,
        source: metadata.siteName?.source ?? "url:hostname",
      },
      resourceKind: {
        resolver: this.key,
        source: metadata.resourceKind?.source ?? "generic:fallback",
      },
    };
    if (metadata.description)
      provenance.description = {
        resolver: this.key,
        source: metadata.description.source,
      };
    if (metadata.canonicalUrl && canonicalUrl)
      provenance.canonicalUrl = {
        resolver: this.key,
        source: metadata.canonicalUrl.source,
      };

    return {
      resolverKey: this.key,
      resolverVersion: this.version,
      finalUrl: finalUrl.toString(),
      canonicalUrl,
      title,
      description: metadata.description?.value ?? null,
      siteName,
      resourceKind: metadata.resourceKind?.value ?? "web_page",
      fieldProvenance: provenance,
      providerExtensions: {},
      media: [
        ...(previewUrl
          ? [
              {
                role: "preview" as const,
                sourceUrl: previewUrl,
                sourceMetadata: metadata.previewUrl?.source ?? "unknown",
                processingProfile: "link-preview-v1",
                alt: metadata.previewAlt ?? null,
              },
            ]
          : []),
        ...(faviconUrl
          ? [
              {
                role: "icon" as const,
                sourceUrl: faviconUrl,
                sourceMetadata:
                  metadata.faviconUrl?.source ?? "url:favicon-fallback",
                processingProfile: "icon-v1",
              },
            ]
          : []),
      ],
    };
  }
}

function safeMetadataUrl(value: string | undefined, base: URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.toString().length > 4096
    )
      return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function fallbackTitle(url: URL): string {
  const path = decodeURIComponent(url.pathname)
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/[-_]+/g, " ")
    .trim();
  return (path || url.hostname).slice(0, 255);
}
