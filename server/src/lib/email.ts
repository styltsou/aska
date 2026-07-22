import { Resend } from "resend";

import { env } from "@/config/env";

let _resend: Resend | undefined;

function getResend(): Resend {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const { error } = await getResend().emails.send({
    from: "Aska <noreply@aska.app>",
    to,
    subject,
    text,
  });

  if (error) {
    console.error("Failed to send email:", error);
  }
}
