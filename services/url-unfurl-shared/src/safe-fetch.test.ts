import dns from "node:dns/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPinnedLookup,
  isPublicAddress,
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
