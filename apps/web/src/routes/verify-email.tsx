import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { LoaderCircleIcon, MailIcon } from "lucide-react";
import { AuthPending } from "@/components/auth/auth-pending";
import { CenteredAuthLayout } from "@/components/auth/centered-auth-layout";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

type VerifySearch = {
  email?: string;
};

const RESEND_COOLDOWN_SECONDS = 30;

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search): VerifySearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  beforeLoad: async ({ search }) => {
    await redirectIfSignedIn();
    // Only reachable from signup or an unverified password sign-in, both of
    // which pass the address.
    if (!search.email) {
      throw redirect({ to: "/login", replace: true });
    }
  },
  pendingComponent: AuthPending,
  pendingMs: 0,
  head: () => ({
    meta: [{ title: "Verify your email | Mnemee" }],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const search = Route.useSearch();
  // The server has already sent a link (signup / unverified sign-in), so the
  // page only offers a resend.
  const email = search.email;
  const [cooldown, setCooldown] = useState(email ? RESEND_COOLDOWN_SECONDS : 0);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (!email) return;
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
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <CenteredAuthLayout>
      <div aria-labelledby="verify-title">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold" id="verify-title">
            Verify your email
          </h1>
          <p className="text-sm text-muted-foreground">
            <>
              We sent a link to{" "}
              <span className="font-medium text-foreground">{email}</span>. Open
              it to continue.
            </>
          </p>
        </div>

        <div className="mt-6">
          <Button
            className="h-10 w-full"
            disabled={isSending || cooldown > 0}
            onClick={() => void resend()}
            type="button"
            variant={cooldown > 0 ? "outline" : "default"}
          >
            {isSending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <MailIcon />
            )}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
          </Button>
        </div>

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
