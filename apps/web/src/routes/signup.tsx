import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircleIcon, UserPlusIcon } from "lucide-react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/password-field";
import { Input } from "@/components/ui/input";
import { clearAuthStateCache, redirectIfSignedIn } from "@/lib/auth-flow";
import { signUp } from "@/lib/auth-client";
import { clearLastLoginMethod } from "@/lib/last-login-method";

export const Route = createFileRoute("/signup")({
  beforeLoad: redirectIfSignedIn,
  head: () => ({
    meta: [{ title: "Create account | Mnemee" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
    void navigate({ to: "/verify-email", search: { email }, replace: true });
  }

  return (
    <AuthPageLayout>
      <div aria-labelledby="sign-up-title">
        <div className="space-y-1.5">
          <h1
            className="text-2xl font-semibold tracking-[-0.035em]"
            id="sign-up-title"
          >
            Create account
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up your first workspace next.
          </p>
        </div>
        <GoogleSignIn />
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
          <PasswordField
            label="Password"
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
              <UserPlusIcon />
            )}
            <span>{isSubmitting ? "Creating account" : "Create account"}</span>
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 ease-[ease] hover:decoration-current"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
