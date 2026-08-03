import { createSign } from "node:crypto";

export const CLOUDFRONT_SIGNED_COOKIE_NAMES = [
  "CloudFront-Policy",
  "CloudFront-Signature",
  "CloudFront-Key-Pair-Id",
  "CloudFront-Hash-Algorithm",
] as const;

export type CloudFrontSignedCookieConfig = {
  mediaBaseUrl: string;
  workspaceId: string;
  publicKeyId: string;
  privateKeyBase64: string;
  expiresInSeconds: number;
};

export type CloudFrontSignedCookie = {
  name: (typeof CLOUDFRONT_SIGNED_COOKIE_NAMES)[number];
  value: string;
};

/**
 * Creates the three CloudFront viewer cookies plus an explicit SHA-256 marker.
 * A cookie grants access only to one workspace's immutable image namespace.
 */
export function createCloudFrontSignedCookies(
  config: CloudFrontSignedCookieConfig,
  now = Date.now(),
): CloudFrontSignedCookie[] {
  const expiresAt = Math.floor(now / 1000) + config.expiresInSeconds;
  const policy = JSON.stringify({
    Statement: [
      {
        Resource: `${config.mediaBaseUrl}/${config.workspaceId}/*`,
        Condition: { DateLessThan: { "AWS:EpochTime": expiresAt } },
      },
    ],
  });
  const privateKey = Buffer.from(config.privateKeyBase64, "base64").toString(
    "utf8",
  );
  const signer = createSign("RSA-SHA256");
  signer.update(policy);
  signer.end();

  return [
    { name: "CloudFront-Policy", value: cloudFrontBase64(policy) },
    {
      name: "CloudFront-Signature",
      value: cloudFrontBase64(signer.sign(privateKey)),
    },
    { name: "CloudFront-Key-Pair-Id", value: config.publicKeyId },
    { name: "CloudFront-Hash-Algorithm", value: "SHA256" },
  ];
}

function cloudFrontBase64(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("=", "_")
    .replaceAll("/", "~");
}
