import { useState } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { KeyRoundIcon, LoaderCircleIcon } from "lucide-react";
import { AuthPending } from "@/components/auth/auth-pending";
import { CenteredAuthLayout } from "@/components/auth/centered-auth-layout";
import { PasswordField } from "@/components/auth/password-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { redirectIfSignedIn } from "@/lib/auth-flow";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search): ResetSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    await redirectIfSignedIn();
    // Reached only through an emailed link, which carries a token or error.
    if (!search.token && !search.error) {
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
  const { token, error: linkError } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linkInvalid = !token || Boolean(linkError);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (error) {
      setError(error.message ?? "Unable to reset your password.");
      setIsSubmitting(false);
      return;
    }
    void navigate({ to: "/login", replace: true });
  }

  return (
    <CenteredAuthLayout>
      <div aria-labelledby="reset-title">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold" id="reset-title">
            {linkInvalid ? "Link expired" : "Set a new password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {linkInvalid
              ? "This reset link is invalid or has expired."
              : "Choose a new password for your account."}
          </p>
        </div>
        {linkInvalid ? (
          <Link
            className={buttonVariants({ className: "mt-6 h-10 w-full" })}
            to="/forgot-password"
          >
            Request a new link
          </Link>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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
            <Button
              className="h-10 w-full"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <KeyRoundIcon />
              )}
              Reset password
            </Button>
          </form>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
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
