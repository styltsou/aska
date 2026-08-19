import { describe, expect, it } from "vitest";

import { isPublicAddress, validateNetworkUrl } from "./safe-fetch";

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
});
