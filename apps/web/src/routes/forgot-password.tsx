import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircleIcon, MailIcon } from "lucide-react";
import { CenteredAuthLayout } from "@/components/auth/centered-auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: redirectIfSignedIn,
  head: () => ({
    meta: [{ title: "Forgot password | Mnemee" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSending(true);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: new URL("/reset-password", window.location.origin).href,
    });
    setIsSending(false);
    if (error) {
      setError(error.message ?? "Couldn't send the email. Please try again.");
      return;
    }
    setSentTo(email);
  }

  return (
    <CenteredAuthLayout>
      <div aria-labelledby="forgot-title">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold" id="forgot-title">
            {sentTo ? "Check your email" : "Forgot password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sentTo
              ? `If an account exists for ${sentTo}, we sent a link to reset its password.`
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>
        {sentTo ? null : (
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
              Send reset link
            </Button>
          </form>
        )}
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
