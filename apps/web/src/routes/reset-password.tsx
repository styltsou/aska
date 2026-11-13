import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { KeyRoundIcon, LoaderCircleIcon } from "lucide-react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { AuthPending } from "@/components/auth/auth-pending";
import { OTP_LENGTH, OtpField } from "@/components/auth/otp-field";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

type ResetSearch = { email?: string };

const RESEND_COOLDOWN_SECONDS = 30;

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search): ResetSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  beforeLoad: async ({ search }) => {
    await redirectIfSignedIn();
    // Reached only after requesting a code, which passes the address.
    if (!search.email) {
      throw redirect({ to: "/forgot-password", replace: true });
    }
  },
  pendingComponent: AuthPending,
  pendingMs: 0,
  head: () => ({
    meta: [{ title: "Reset password | Mnemee" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    setError(null);
    if (code.length !== OTP_LENGTH) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await authClient.emailOtp.resetPassword({
      email,
      otp: code,
      password,
    });
    if (error) {
      setError(error.message ?? "Unable to reset your password.");
      setIsSubmitting(false);
      return;
    }
    void navigate({ to: "/login", replace: true });
  }

  async function resend() {
    if (!email) return;
    setError(null);
    setIsSending(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email,
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
    <AuthPageLayout>
      <div aria-labelledby="reset-title">
        <div className="space-y-1.5">
          <h1
            className="text-2xl font-semibold tracking-[-0.035em]"
            id="reset-title"
          >
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for{" "}
            <span className="font-medium text-foreground">{email}</span>, we
            sent it a 6-digit code. Enter it with a new password.
          </p>
        </div>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="reset-code">
              Code
            </label>
            <OtpField
              // Deliberate: this step exists only to enter the code.
              // oxlint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              disabled={isSubmitting}
              id="reset-code"
              invalid={Boolean(error)}
              onChange={setCode}
              value={code}
            />
          </div>
          <PasswordField
            label="New password"
            id="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordField
            label="Confirm password"
            id="confirm-password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="h-10 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <KeyRoundIcon />
            )}
            Reset password
          </Button>
        </form>

        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted-foreground">
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
            to="/forgot-password"
          >
            Wrong email?
          </Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
