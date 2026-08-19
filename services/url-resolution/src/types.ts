export type ResolverMedia = {
  role: "preview" | "icon" | "primary" | "cover";
  sourceUrl: string;
  sourceMetadata: string;
  processingProfile: string;
  alt?: string | null;
};

export type ResolverResult = {
  resolverKey: string;
  resolverVersion: string;
  finalUrl: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  siteName: string | null;
  resourceKind: string;
  fieldProvenance: Record<string, { resolver: string; source: string }>;
  providerExtensions: Record<string, unknown>;
  media: ResolverMedia[];
};

export interface UrlResolver {
  key: string;
  version: string;
  matches(url: URL): boolean;
  resolve(url: URL): Promise<ResolverResult>;
  /** Continue through matching resolvers so later resolvers can fill missing fields. */
  continueAfterResolve?: boolean;
}

/** Ordered, composable selection with the generic resolver registered last. */
export async function resolveWithRegistry(
  url: URL,
  resolvers: readonly UrlResolver[],
): Promise<ResolverResult> {
  let resolved: ResolverResult | undefined;
  let lastError: unknown;

  for (const resolver of resolvers) {
    if (!resolver.matches(url)) continue;
    try {
      const result = await resolver.resolve(url);
      resolved = resolved ? mergeResolverResults(resolved, result) : result;
      if (!resolver.continueAfterResolve) return resolved;
    } catch (error) {
      lastError = error;
      // A provider failure must not prevent a later generic resolver from trying.
    }
  }

  if (resolved) return resolved;
  if (lastError instanceof Error) throw lastError;
  throw new Error("No URL resolver matched");
}

/** Earlier (typically provider-specific) values win; later resolvers fill gaps. */
function mergeResolverResults(
  preferred: ResolverResult,
  fallback: ResolverResult,
): ResolverResult {
  const mediaRoles = new Set(preferred.media.map((media) => media.role));
  return {
    ...fallback,
    ...preferred,
    canonicalUrl: preferred.canonicalUrl ?? fallback.canonicalUrl,
    title: preferred.title ?? fallback.title,
    description: preferred.description ?? fallback.description,
    siteName: preferred.siteName ?? fallback.siteName,
    resourceKind:
      preferred.resourceKind === "unknown"
        ? fallback.resourceKind
        : preferred.resourceKind,
    fieldProvenance: {
      ...fallback.fieldProvenance,
      ...preferred.fieldProvenance,
    },
    providerExtensions: {
      ...fallback.providerExtensions,
      ...preferred.providerExtensions,
    },
    media: [
      ...preferred.media,
      ...fallback.media.filter((media) => !mediaRoles.has(media.role)),
    ],
  };
}
