import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "bun:test";

import {
  deriveCloudFrontPublicKey,
  parseCloudFrontPrivateKey,
} from "./cloudfront-key";

describe("CloudFront signing key", () => {
  it("derives the matching SPKI public key from one RSA-2048 secret", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const privateKeyBase64 = Buffer.from(
      privateKey.export({ type: "pkcs8", format: "pem" }),
    ).toString("base64");

    const derived = deriveCloudFrontPublicKey(privateKeyBase64);
    const expected = publicKey
      .export({ type: "spki", format: "pem" })
      .toString();

    expect(derived).toBe(expected);
  });

  it("rejects malformed base64 before deployment", () => {
    expect(() => parseCloudFrontPrivateKey("not a base64 key")).toThrow(
      "single base64-encoded PEM value",
    );
  });

  it("rejects unsupported key sizes before deployment", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const privateKeyBase64 = Buffer.from(
      privateKey.export({ type: "pkcs8", format: "pem" }),
    ).toString("base64");

    expect(() => parseCloudFrontPrivateKey(privateKeyBase64)).toThrow(
      "must be 2048 bits",
    );
  });
});
