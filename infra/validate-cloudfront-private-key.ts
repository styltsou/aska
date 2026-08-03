import { deriveCloudFrontPublicKey } from "./cloudfront-key";

const privateKeyBase64 = process.env.CLOUDFRONT_MEDIA_PRIVATE_KEY_BASE64;
if (!privateKeyBase64) {
  throw new Error("CLOUDFRONT_MEDIA_PRIVATE_KEY_BASE64 is required.");
}

deriveCloudFrontPublicKey(privateKeyBase64);
console.log("CloudFront media signing key is a valid RSA-2048 private key.");
