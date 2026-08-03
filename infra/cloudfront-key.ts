import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";

const REQUIRED_RSA_MODULUS_LENGTH = 2048;

/**
 * Parses the single CloudFront signing secret and derives the public key that
 * the trusted key group must use. Keeping one source of truth makes a
 * mismatched public/private deployment impossible.
 */
export function deriveCloudFrontPublicKey(privateKeyBase64: string): string {
  const privateKey = parseCloudFrontPrivateKey(privateKeyBase64);
  return createPublicKey(privateKey)
    .export({ type: "spki", format: "pem" })
    .toString();
}

export function parseCloudFrontPrivateKey(privateKeyBase64: string): KeyObject {
  const encoded = privateKeyBase64.trim();
  if (!encoded || !isCanonicalBase64(encoded)) {
    throw new Error(
      "CloudFrontMediaPrivateKeyBase64 must be a single base64-encoded PEM value.",
    );
  }

  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(Buffer.from(encoded, "base64"));
  } catch {
    throw new Error(
      "CloudFrontMediaPrivateKeyBase64 does not decode to a valid private key PEM.",
    );
  }

  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new Error("The CloudFront signing key must be an RSA key.");
  }
  if (
    privateKey.asymmetricKeyDetails?.modulusLength !==
    REQUIRED_RSA_MODULUS_LENGTH
  ) {
    throw new Error(
      `The CloudFront signing key must be ${REQUIRED_RSA_MODULUS_LENGTH} bits.`,
    );
  }

  return privateKey;
}

function isCanonicalBase64(value: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return false;
  }
  return Buffer.from(value, "base64").toString("base64") === value;
}
