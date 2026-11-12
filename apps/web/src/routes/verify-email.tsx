import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import { AuthPending } from "@/components/auth/auth-pending";
import { CenteredAuthLayout } from "@/components/auth/centered-auth-layout";
import { OTP_LENGTH, OtpField } from "@/components/auth/otp-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { clearAuthStateCache, redirectIfSignedIn } from "@/lib/auth-flow";

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
  const navigate = useNavigate();
  // The server has already mailed a code (signup / unverified sign-in), so the
  // page only collects it and offers a resend.
  const email = search.email;
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(email ? RESEND_COOLDOWN_SECONDS : 0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify(value: string) {
    if (!email || isVerifying || value.length !== OTP_LENGTH) return;
    setError(null);
    setIsVerifying(true);
    // On success the server verifies the address and signs the user in
    // (`autoSignInAfterVerification`); /login then routes them onward.
    const { error } = await authClient.emailOtp.verifyEmail({
      email,
      otp: value,
    });
    if (error) {
      setError(error.message ?? "That code didn't work. Please try again.");
      setCode("");
      setIsVerifying(false);
      return;
    }
    clearAuthStateCache();
    void navigate({ to: "/login", replace: true });
  }

  async function resend() {
    if (!email) return;
    setError(null);
    setIsSending(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    setIsSending(false);
    if (error) {
      setError(error.message ?? "Couldn't send the email. Please try again.");
      return;
    }
    setCode("");
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
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>

        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
        >
          <OtpField
            autoFocus
            disabled={isVerifying}
            id="verify-code"
            invalid={Boolean(error)}
            onChange={setCode}
            onComplete={(value) => void verify(value)}
            value={code}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            className="h-10 w-full"
            disabled={isVerifying || code.length !== OTP_LENGTH}
            type="submit"
          >
            {isVerifying ? <LoaderCircleIcon className="animate-spin" /> : null}
            Verify email
          </Button>
        </form>

        <p className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>
            Didn&apos;t get it?{" "}
            <button
              className="font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 ease-[ease] hover:decoration-current disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              disabled={isSending || cooldown > 0}
              onClick={() => void resend()}
              type="button"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </span>
          <span aria-hidden="true">·</span>
          <Link
            className="transition-colors duration-150 ease-[ease] hover:text-foreground"
            to="/signup"
          >
            Wrong email?
          </Link>
        </p>
      </div>
    </CenteredAuthLayout>
  );
}
