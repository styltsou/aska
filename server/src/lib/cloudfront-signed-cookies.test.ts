import { generateKeyPairSync, createVerify } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCloudFrontSignedCookies } from "./cloudfront-signed-cookies";

describe("createCloudFrontSignedCookies", () => {
  it("signs a workspace-only policy with CloudFront's URL-safe base64 alphabet", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const cookies = createCloudFrontSignedCookies(
      {
        mediaBaseUrl: "https://images.example.com",
        workspaceId: "workspace-1",
        publicKeyId: "KTEST123",
        privateKeyBase64: Buffer.from(
          privateKey.export({ type: "pkcs8", format: "pem" }),
        ).toString("base64"),
        expiresInSeconds: 3600,
      },
      1_700_000_000_000,
    );
    const values = new Map(
      cookies.map((cookie) => [cookie.name, cookie.value]),
    );
    const policy = decodeCloudFrontBase64(
      values.get("CloudFront-Policy")!,
    ).toString("utf8");

    expect(JSON.parse(policy)).toEqual({
      Statement: [
        {
          Resource: "https://images.example.com/workspace-1/*",
          Condition: { DateLessThan: { "AWS:EpochTime": 1_700_003_600 } },
        },
      ],
    });
    expect(values.get("CloudFront-Key-Pair-Id")).toBe("KTEST123");
    expect(values.get("CloudFront-Hash-Algorithm")).toBe("SHA256");
    expect(values.get("CloudFront-Policy")).not.toMatch(/[+=/]/);
    expect(values.get("CloudFront-Signature")).not.toMatch(/[+=/]/);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(policy);
    verifier.end();
    expect(
      verifier.verify(
        publicKey,
        decodeCloudFrontBase64(values.get("CloudFront-Signature")!),
      ),
    ).toBe(true);
  });
});

function decodeCloudFrontBase64(value: string): Buffer {
  return Buffer.from(
    value.replaceAll("-", "+").replaceAll("_", "=").replaceAll("~", "/"),
    "base64",
  );
}
