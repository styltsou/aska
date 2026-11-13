import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthPending } from "@/components/auth/auth-pending";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { AuthSlot } from "@/components/auth/auth-slot";
import { useAuthEmail } from "@/lib/auth-email";
import { AuthBackLabel, authBackClassName } from "@/components/auth/auth-back";
import {
  AUTH_REVERSE_VIEW_TRANSITION,
  AUTH_VIEW_TRANSITION,
} from "@/components/auth/auth-view-transition";
import {
  AuthActionButton,
  AuthError,
} from "@/components/auth/auth-form-controls";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: redirectIfSignedIn,
  pendingComponent: AuthPending,
  pendingMs: 300,
  head: () => ({
    meta: [{ title: "Forgot password | Mnemee" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useAuthEmail();
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSending(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    if (error) {
      setIsSending(false);
      setError(error.message ?? "Couldn't send the email. Please try again.");
      return;
    }
    // The response is identical whether or not the account exists, so always
    // continue to the code step.
    void navigate({
      to: "/reset-password",
      search: { email },
      viewTransition: AUTH_VIEW_TRANSITION,
    });
  }

  return (
    <AuthPageLayout
      canvasStop="write"
      anchorContent
      back={
        <Link
          aria-label="Back to sign in"
          className={authBackClassName}
          to="/login"
          viewTransition={AUTH_REVERSE_VIEW_TRANSITION}
        >
          <AuthBackLabel />
        </Link>
      }
    >
      <div aria-labelledby="forgot-title">
        <div className="space-y-1.5">
          <AuthSlot kind="text" name="title">
            <h1
              className="text-2xl font-semibold tracking-[-0.035em]"
              id="forgot-title"
            >
              Forgot password
            </h1>
          </AuthSlot>
          <AuthSlot kind="text" name="subtitle">
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a 6-digit code.
            </p>
          </AuthSlot>
        </div>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <AuthSlot name="email">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                className="h-10 px-3 transition-[background-color,color]"
                id="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(error)}
                required
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <AuthError message={error} />
          </AuthSlot>
          <AuthSlot name="submit">
            <AuthActionButton disabled={isSending} type="submit">
              {isSending ? "Sending code" : "Send code"}
            </AuthActionButton>
          </AuthSlot>
        </form>
      </div>
    </AuthPageLayout>
  );
}
