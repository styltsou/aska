import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon, MailIcon } from "lucide-react";
import { AuthPending } from "@/components/auth/auth-pending";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: redirectIfSignedIn,
  pendingComponent: AuthPending,
  pendingMs: 0,
  head: () => ({
    meta: [{ title: "Forgot password | Mnemee" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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
    void navigate({ to: "/reset-password", search: { email } });
  }

  return (
    <AuthPageLayout>
      <div aria-labelledby="forgot-title">
        <div className="space-y-1.5">
          <h1
            className="text-2xl font-semibold tracking-[-0.035em]"
            id="forgot-title"
          >
            Forgot password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a 6-digit code.
          </p>
        </div>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="h-10 w-full" disabled={isSending} type="submit">
            {isSending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <MailIcon />
            )}
            Send code
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            className="font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 ease-[ease] hover:decoration-current"
            to="/login"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
