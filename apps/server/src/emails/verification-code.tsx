/** @jsxImportSource react */
import { CodeEmail, type CodeEmailProps } from "./code-email";

export default function VerificationCodeEmail(props: CodeEmailProps) {
  return (
    <CodeEmail
      {...props}
      intro="Enter this code on the verification page to confirm your email address and finish signing in."
      preview={`${props.code} is your Mnemee verification code`}
      title="Verify your email"
    />
  );
}

VerificationCodeEmail.PreviewProps = {
  code: "482916",
  expiresInMinutes: 10,
} satisfies CodeEmailProps;
