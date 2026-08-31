import { describe, expect, it } from "vitest";

import {
  resolveWithRegistry,
  type ResolverResult,
  type UrlResolver,
} from "./types";

const result: ResolverResult = {
  resolverKey: "generic",
  resolverVersion: "1",
  finalUrl: "https://example.com/",
  canonicalUrl: null,
  title: "Example",
  description: null,
  siteName: "Example",
  resourceKind: "web_page",
  fieldProvenance: {},
  providerExtensions: {},
  media: [],
};

describe("resolver registry", () => {
  it("selects the first matching resolver and keeps generic last", async () => {
    const calls: string[] = [];
    const resolver = (key: string, matches: boolean): UrlResolver => ({
      key,
      version: "1",
      matches: () => matches,
      resolve: async () => {
        calls.push(key);
        return { ...result, resolverKey: key };
      },
    });
    const resolved = await resolveWithRegistry(new URL("https://example.com"), [
      resolver("specialized", false),
      resolver("generic", true),
    ]);
    expect(resolved.resolverKey).toBe("generic");
    expect(calls).toEqual(["generic"]);
  });

  it("lets a specialized resolver enrich a generic fallback", async () => {
    const specialized: UrlResolver = {
      key: "specialized",
      version: "2",
      matches: () => true,
      continueAfterResolve: true,
      resolve: async () => ({
        ...result,
        resolverKey: "specialized",
        resolverVersion: "2",
        title: "Provider title",
        description: null,
        resourceKind: "unknown",
        providerExtensions: { postId: "123" },
        media: [
          {
            role: "preview",
            sourceUrl: "https://provider.test/preview.jpg",
            sourceMetadata: "provider:image",
            processingProfile: "link-preview-v1",
          },
        ],
      }),
    };
    const generic: UrlResolver = {
      key: "generic",
      version: "1",
      matches: () => true,
      resolve: async () => ({
        ...result,
        description: "Generic description",
        resourceKind: "web_page",
        media: [
          {
            role: "preview",
            sourceUrl: "https://generic.test/preview.jpg",
            sourceMetadata: "og:image",
            processingProfile: "link-preview-v1",
          },
          {
            role: "icon",
            sourceUrl: "https://generic.test/favicon.ico",
            sourceMetadata: "link:icon",
            processingProfile: "icon-v1",
          },
        ],
      }),
    };

    const resolved = await resolveWithRegistry(new URL("https://example.com"), [
      specialized,
      generic,
    ]);

    expect(resolved).toMatchObject({
      resolverKey: "specialized",
      title: "Provider title",
      description: "Generic description",
      resourceKind: "web_page",
      providerExtensions: { postId: "123" },
    });
    expect(
      resolved.media.map(({ role, sourceUrl }) => ({ role, sourceUrl })),
    ).toEqual([
      {
        role: "preview",
        sourceUrl: "https://provider.test/preview.jpg",
      },
      { role: "icon", sourceUrl: "https://generic.test/favicon.ico" },
    ]);
  });

  it("falls back when a specialized resolver fails", async () => {
    const failing: UrlResolver = {
      key: "specialized",
      version: "1",
      matches: () => true,
      resolve: async () => {
        throw new Error("rate limited");
      },
    };
    const generic: UrlResolver = {
      key: "generic",
      version: "1",
      matches: () => true,
      resolve: async () => result,
    };

    await expect(
      resolveWithRegistry(new URL("https://example.com"), [failing, generic]),
    ).resolves.toEqual(result);
  });

  it("keeps a successful specialized result when generic fallback fails", async () => {
    const specialized: UrlResolver = {
      key: "specialized",
      version: "1",
      matches: () => true,
      continueAfterResolve: true,
      resolve: async () => ({
        ...result,
        resolverKey: "specialized",
        title: "Provider title",
      }),
    };
    const generic: UrlResolver = {
      key: "generic",
      version: "1",
      matches: () => true,
      resolve: async () => {
        throw new Error("response too large");
      },
    };

    await expect(
      resolveWithRegistry(new URL("https://example.com"), [
        specialized,
        generic,
      ]),
    ).resolves.toMatchObject({
      resolverKey: "specialized",
      title: "Provider title",
    });
  });
});
