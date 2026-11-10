import dns from "node:dns/promises";
import http from "node:http";
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPinnedLookup,
  isPublicAddress,
  readBoundedBody,
  safeFetch,
  safeInspectContentType,
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

  it("applies the same address policy while inspecting media headers", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ] as never);

    await expect(
      safeInspectContentType("https://example.test/video"),
    ).rejects.toMatchObject({ category: "unsafe_url" });
  });

  it("follows a safe redirect and identifies media from headers without reading the body", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
    ] as never);
    const request = vi
      .spyOn(http, "request")
      .mockImplementation((url, _options, callback) => {
        const outgoing = new EventEmitter() as ReturnType<typeof http.request>;
        outgoing.setTimeout = vi.fn() as never;
        outgoing.end = (() => {
          const incoming = new PassThrough() as unknown as http.IncomingMessage;
          const redirected = String(url).endsWith("/original");
          incoming.statusCode = redirected ? 302 : 200;
          incoming.headers = redirected
            ? { location: "/without-extension" }
            : { "content-type": "video/mp4; charset=binary" };
          callback!(incoming);
          return outgoing;
        }) as never;
        return outgoing;
      });

    await expect(
      safeInspectContentType("http://example.test/original", 1_000),
    ).resolves.toEqual({
      contentType: "video/mp4",
      finalUrl: "http://example.test/without-extension",
    });
    expect(request).toHaveBeenCalledTimes(2);
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

  it("returns the retained head prefix when an HTML head exceeds its budget", async () => {
    const truncated = `<head>${"x".repeat(1_024)}</head>`;

    await expect(
      readBoundedBody(response(truncated), 256, signal, "html-head"),
    ).resolves.toEqual(
      Buffer.from(`<head>${"x".repeat(1_024).slice(0, 256 - "<head>".length)}`),
    );
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
