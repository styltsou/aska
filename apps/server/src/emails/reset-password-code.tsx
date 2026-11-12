/** @jsxImportSource react */
import { CodeEmail, type CodeEmailProps } from "./code-email";

export default function ResetPasswordCodeEmail(props: CodeEmailProps) {
  return (
    <CodeEmail
      {...props}
      intro="Enter this code on the reset page, along with your new password, to regain access to your account."
      preview={`${props.code} is your Mnemee password reset code`}
      title="Reset your password"
    />
  );
}

ResetPasswordCodeEmail.PreviewProps = {
  code: "482916",
  expiresInMinutes: 10,
} satisfies CodeEmailProps;
