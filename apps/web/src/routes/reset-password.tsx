import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { AuthPending } from "@/components/auth/auth-pending";
import { OTP_LENGTH, OtpField } from "@/components/auth/otp-field";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthFeedback } from "@/components/auth/password-strength-feedback";
import {
  AuthActionButton,
  AuthError,
  ResendCodeLabel,
} from "@/components/auth/auth-form-controls";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

type ResetSearch = { email?: string };

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_ERROR_CODES = new Set([
  "INVALID_OTP",
  "OTP_EXPIRED",
  "TOO_MANY_ATTEMPTS",
]);

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
  const [step, setStep] = useState<"code" | "password">("code");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
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

  async function verifyCode(value: string) {
    if (!email || isSubmitting || value.length !== OTP_LENGTH) return;
    setError(null);
    setIsSubmitting(true);
    // Checks the code without consuming it; resetPassword verifies it again.
    const { error } = await authClient.emailOtp.checkVerificationOtp({
      email,
      type: "forget-password",
      otp: value,
    });
    setIsSubmitting(false);
    if (error) {
      setError(error.message ?? "That code didn't work. Please try again.");
      setCode("");
      return;
    }
    setStep("password");
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    setError(null);
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
      setIsSubmitting(false);
      // The code expired or ran out of attempts between the two steps.
      if (error.code && OTP_ERROR_CODES.has(error.code)) {
        setCode("");
        setPassword("");
        setConfirmPassword("");
        setStep("code");
        setError("That code has expired. Enter a new one.");
        return;
      }
      setError(error.message ?? "Unable to reset your password.");
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
    <AuthPageLayout anchorContent>
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
            sent it a 6-digit code.
          </p>
        </div>
        {step === "code" ? (
          <>
            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void verifyCode(code);
              }}
            >
              <div>
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
                    onChange={(value) => {
                      setCode(value);
                      setError(null);
                    }}
                    onComplete={(value) => void verifyCode(value)}
                    value={code}
                  />
                </div>
                <AuthError message={error} />
              </div>
              <AuthActionButton
                disabled={isSubmitting || code.length !== OTP_LENGTH}
                type="submit"
              >
                {isSubmitting ? "Checking code" : "Continue"}
              </AuthActionButton>
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
                  <ResendCodeLabel seconds={cooldown} />
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
          </>
        ) : (
          <>
            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => void handlePasswordSubmit(event)}
            >
              <div>
                <PasswordField
                  label="New password"
                  id="password"
                  autoComplete="new-password"
                  aria-describedby={password ? "password-feedback" : undefined}
                  // Deliberate: the code is verified, so this is the next input.
                  // oxlint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <PasswordStrengthFeedback
                  password={password}
                  email={email ?? ""}
                  expanded={passwordFocused}
                />
              </div>
              <div>
                <PasswordField
                  label="Confirm password"
                  id="confirm-password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(error)}
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError(null);
                  }}
                />
                <AuthError message={error} />
              </div>
              <AuthActionButton disabled={isSubmitting} type="submit">
                {isSubmitting ? "Resetting password" : "Reset password"}
              </AuthActionButton>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              <button
                className="transition-colors duration-150 ease-[ease] hover:text-foreground"
                onClick={() => {
                  setError(null);
                  setCode("");
                  setStep("code");
                }}
                type="button"
              >
                Back
              </button>
            </p>
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
