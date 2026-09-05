import dns from "node:dns/promises";
import { Readable } from "node:stream";
import type http from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPinnedLookup,
  isPublicAddress,
  readBoundedBody,
  safeFetch,
  validateNetworkUrl,
} from "./safe-fetch";

afterEach(() => vi.restoreAllMocks());

describe("safe remote fetch address policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fc00::1",
  ])("blocks non-public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public unicast address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it("rejects credentials and unsupported schemes", () => {
    expect(() => validateNetworkUrl("https://u:p@example.com")).toThrow();
    expect(() => validateNetworkUrl("file:///etc/passwd")).toThrow();
  });

  it("returns every pinned address when Node requests lookup all mode", () => {
    const addresses = [
      { address: "1.1.1.1", family: 4 as const },
      { address: "2606:4700:4700::1111", family: 6 as const },
    ];
    const lookup = createPinnedLookup(addresses);
    let result: unknown;

    lookup("example.com", { all: true }, (error, value, family) => {
      expect(error).toBeNull();
      expect(family).toBeUndefined();
      result = value;
    });

    expect(result).toEqual(addresses);
  });

  it("returns the first pinned address for single-address lookup mode", () => {
    const lookup = createPinnedLookup([
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    let result: unknown;

    lookup("example.com", { all: false }, (error, value, family) => {
      expect(error).toBeNull();
      result = { value, family };
    });

    expect(result).toEqual({ value: "1.1.1.1", family: 4 });
  });

  it("rejects a DNS answer when any resolved address is non-public", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ] as never);

    await expect(
      safeFetch("https://example.test", {
        accept: "text/html",
        allowedContentTypes: ["text/html"],
        maxBytes: 1024,
        totalTimeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ category: "unsafe_url", retryable: false });
  });
});

describe("bounded response bodies", () => {
  const signal = new AbortController().signal;
  const response = (...chunks: string[]) =>
    Readable.from(
      chunks.map((chunk) => Buffer.from(chunk)),
    ) as http.IncomingMessage;

  it("returns only a complete HTML head and ignores the remaining body", async () => {
    const stream = response(
      "<html><head><title>Useful metadata</title>",
      "</he",
      "ad><body>",
      "x".repeat(2_000),
      "</body></html>",
    );

    await expect(
      readBoundedBody(stream, 1_024, signal, "html-head"),
    ).resolves.toEqual(
      Buffer.from("<html><head><title>Useful metadata</title></head>"),
    );
  });

  it("recognizes mixed-case closing tags with HTML whitespace", async () => {
    await expect(
      readBoundedBody(
        response("<HTML><HEAD><title>Title</title></HeAd \n><body>ignored"),
        1_024,
        signal,
        "html-head",
      ),
    ).resolves.toEqual(
      Buffer.from("<HTML><HEAD><title>Title</title></HeAd \n>"),
    );
  });

  it("keeps small malformed or headless documents compatible", async () => {
    const document = "<meta name=description content=test><body>content</body>";

    await expect(
      readBoundedBody(response(document), 1_024, signal, "html-head"),
    ).resolves.toEqual(Buffer.from(document));
  });

  it("rejects an HTML head that exceeds its byte budget", async () => {
    await expect(
      readBoundedBody(
        response(`<head>${"x".repeat(1_024)}</head>`),
        256,
        signal,
        "html-head",
      ),
    ).rejects.toMatchObject({
      category: "response_too_large",
      retryable: false,
    });
  });

  it("retains strict full-body limits for existing callers", async () => {
    await expect(
      readBoundedBody(response("x".repeat(257)), 256, signal),
    ).rejects.toMatchObject({
      category: "response_too_large",
      retryable: false,
    });
  });
});
