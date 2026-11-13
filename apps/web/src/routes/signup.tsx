import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthPending } from "@/components/auth/auth-pending";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { AuthSlot } from "@/components/auth/auth-slot";
import { useAuthEmail } from "@/lib/auth-email";
import { AuthBackLabel, authBackClassName } from "@/components/auth/auth-back";
import {
  AUTH_REVERSE_STEP_TRANSITION,
  AUTH_VIEW_TRANSITION,
  transitionAuthStep,
} from "@/components/auth/auth-view-transition";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import {
  AuthActionButton,
  AuthError,
} from "@/components/auth/auth-form-controls";
import { TermsNotice } from "@/components/auth/terms-notice";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthFeedback } from "@/components/auth/password-strength-feedback";
import { Input } from "@/components/ui/input";
import { clearAuthStateCache, redirectIfSignedIn } from "@/lib/auth-flow";
import { signUp } from "@/lib/auth-client";
import { clearLastLoginMethod } from "@/lib/last-login-method";

export const Route = createFileRoute("/signup")({
  beforeLoad: redirectIfSignedIn,
  pendingComponent: AuthPending,
  pendingMs: 300,
  head: () => ({
    meta: [{ title: "Create account | Mnemee" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useAuthEmail();
  const [passwordStep, setPasswordStep] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!passwordStep) {
      transitionAuthStep(() => setPasswordStep(true));
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await signUp.email({
      name: email.split("@")[0] ?? email,
      email,
      password,
      callbackURL: new URL("/login", window.location.origin).href,
    });

    if (error) {
      setError(error.message ?? "Unable to create your account.");
      setIsSubmitting(false);
      return;
    }

    // No session exists until the email is verified.
    clearAuthStateCache();
    clearLastLoginMethod();
    void navigate({
      to: "/verify-email",
      search: { email },
      replace: true,
      viewTransition: AUTH_VIEW_TRANSITION,
    });
  }

  return (
    <AuthPageLayout
      footer={<TermsNotice />}
      anchorContent
      back={
        passwordStep ? (
          <button
            aria-label="Back to email"
            className={authBackClassName}
            onClick={() => {
              transitionAuthStep(() => {
                setError(null);
                setPasswordStep(false);
              }, AUTH_REVERSE_STEP_TRANSITION);
            }}
            type="button"
          >
            <AuthBackLabel />
          </button>
        ) : undefined
      }
    >
      <div aria-labelledby="sign-up-title">
        <div className="space-y-1.5">
          <AuthSlot kind="text" name="title">
            <h1
              className="text-2xl font-semibold tracking-[-0.035em]"
              id="sign-up-title"
            >
              Create account
            </h1>
          </AuthSlot>
          <AuthSlot kind="text" name="subtitle">
            <p className="text-sm text-muted-foreground">
              Set up your first workspace next.
            </p>
          </AuthSlot>
        </div>
        {!passwordStep ? (
          <AuthSlot name="google">
            <GoogleSignIn />
          </AuthSlot>
        ) : null}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <AuthSlot name="email" className="flex flex-col gap-2">
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
          </AuthSlot>
          {passwordStep ? (
            <>
              <AuthSlot name="password">
                <PasswordField
                  label="Password"
                  id="password"
                  // Deliberate: the email step is done, so this is the next input.
                  // oxlint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  autoComplete="new-password"
                  aria-describedby={password ? "password-feedback" : undefined}
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
                  email={email}
                  expanded={passwordFocused}
                />
              </AuthSlot>
              <AuthSlot name="confirm">
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
              </AuthSlot>
            </>
          ) : null}
          <AuthSlot name="submit">
            <AuthActionButton disabled={isSubmitting} type="submit">
              <span>
                {isSubmitting
                  ? "Creating account"
                  : passwordStep
                    ? "Create account"
                    : "Continue"}
              </span>
            </AuthActionButton>
          </AuthSlot>
        </form>
        <AuthSlot
          as="p"
          kind="text"
          name="switch"
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 ease-[ease] hover:decoration-current"
            to="/login"
            viewTransition={AUTH_VIEW_TRANSITION}
          >
            Sign in
          </Link>
        </AuthSlot>
      </div>
    </AuthPageLayout>
  );
}
