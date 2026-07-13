import { Resend } from "resend";

import { env } from "@/config/env";

export const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const { error } = await resend.emails.send({
    from: "Aska <noreply@aska.app>",
    to,
    subject,
    text,
  });

  if (error) {
    console.error("Failed to send email:", error);
  }
}
