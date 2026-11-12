/** @jsxImportSource react */
import type { ReactElement } from "react";
import ResetPasswordCodeEmail from "./reset-password-code";
import VerificationCodeEmail from "./verification-code";

export const OTP_EXPIRES_IN_SECONDS = 600;

/** Subject and body for the one-time-code types we deliver, or `null` for the
 * types we deliberately never send (sign-in, change-email). */
export function buildOtpEmail(
  type: string,
  code: string,
): { subject: string; react: ReactElement } | null {
  const props = { code, expiresInMinutes: OTP_EXPIRES_IN_SECONDS / 60 };
  if (type === "email-verification") {
    return {
      subject: `${code} is your Mnemee verification code`,
      react: <VerificationCodeEmail {...props} />,
    };
  }
  if (type === "forget-password") {
    return {
      subject: `${code} is your Mnemee password reset code`,
      react: <ResetPasswordCodeEmail {...props} />,
    };
  }
  return null;
}
