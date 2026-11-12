import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircleIcon, MailIcon } from "lucide-react";
import { CenteredAuthLayout } from "@/components/auth/centered-auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

type VerifySearch = {
  email?: string;
  reason?: "google";
};

const RESEND_COOLDOWN_SECONDS = 30;

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search): VerifySearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
    reason: search.reason === "google" ? "google" : undefined,
  }),
  beforeLoad: redirectIfSignedIn,
  head: () => ({
    meta: [{ title: "Verify your email | Mnemee" }],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const search = Route.useSearch();
  // With no email (the Google case, where we never learn it) the user types it
  // in; with one, the link has already been sent by signup / sign-in.
  const [email, setEmail] = useState(search.email ?? "");
  const [sentTo, setSentTo] = useState<string | null>(search.email ?? null);
  const [cooldown, setCooldown] = useState(
    search.email ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    setIsSending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: new URL("/login", window.location.origin).href,
    });
    setIsSending(false);
    if (error) {
      setError(error.message ?? "Couldn't send the email. Please try again.");
      return;
    }
    setSentTo(email);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <CenteredAuthLayout>
      <div aria-labelledby="verify-title">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold" id="verify-title">
            {sentTo ? "Check your email" : "Verify your email"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sentTo ? (
              <>
                We sent a link to{" "}
                <span className="font-medium text-foreground">{sentTo}</span>.
                Open it to continue.
              </>
            ) : (
              "Verify your email to connect Google to your account."
            )}
          </p>
        </div>

        {sentTo ? (
          <div className="mt-6 space-y-3">
            <Button
              className="h-10 w-full"
              disabled={isSending || cooldown > 0}
              onClick={() => void send()}
              type="button"
              variant="outline"
            >
              {isSending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <MailIcon />
              )}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </Button>
            {search.reason === "google" ? (
              <p className="text-sm text-muted-foreground">
                Once verified, continue with Google again.
              </p>
            ) : null}
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={send}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                className="h-10 px-3"
                id="email"
                autoComplete="email"
                inputMode="email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button className="h-10 w-full" disabled={isSending} type="submit">
              {isSending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <MailIcon />
              )}
              Send verification link
            </Button>
          </form>
        )}

        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            className="font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 ease-[ease] hover:decoration-current"
            to="/login"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </CenteredAuthLayout>
  );
}
