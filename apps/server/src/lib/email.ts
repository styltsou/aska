import * as Sentry from "@sentry/hono/node";
import { Resend } from "resend";

import { env } from "@/config/env";
import { LoggerService } from "@/services/logger.service";

let _resend: Resend | undefined;
const logger = new LoggerService();

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
  // Better Auth runs verification and reset sends in a way that swallows
  // errors (and must, so a reset never reveals whether an account exists). A
  // failure here is therefore invisible to the user, so report it as a Sentry
  // issue, not just a log line, or it goes unnoticed.
  try {
    const { error } = await getResend().emails.send({
      from: "Mnemee <noreply@mnemee.space>",
      to,
      subject,
      text,
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
  } catch (error) {
    logger.error("Email delivery provider rejected a message", {
      event_name: "email.send.failed",
      error,
    });
    Sentry.captureException(error, {
      tags: { event_name: "email.send.failed" },
    });
  }
}
