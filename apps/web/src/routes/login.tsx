import { useState } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { AuthPending } from "@/components/auth/auth-pending";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import {
  AuthActionButton,
  AuthError,
} from "@/components/auth/auth-form-controls";
import { TermsNotice } from "@/components/auth/terms-notice";
import { PasswordField } from "@/components/auth/password-field";
import { Input } from "@/components/ui/input";
import { clearAuthStateCache, getSignedInDestination } from "@/lib/auth-flow";
import { signIn } from "@/lib/auth-client";
import {
  clearGoogleSignInAttempt,
  clearLastLoginMethod,
  completeGoogleSignIn,
} from "@/lib/last-login-method";

type AuthSearch = {
  redirect?: string;
  google?: "success";
  error?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    google: search.google === "success" ? "success" : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const destination = await getSignedInDestination();
    if (search.google === "success") {
      completeGoogleSignIn(destination.to !== "/login");
    } else {
      clearGoogleSignInAttempt();
    }
    if (destination.to !== "/login") {
      if (
        search.redirect?.startsWith("/") &&
        !search.redirect.startsWith("//")
      ) {
        throw redirect({ href: search.redirect, replace: true });
      }
      throw redirect(destination);
    }
  },
  pendingComponent: AuthPending,
  pendingMs: 0,
  head: () => ({
    meta: [{ title: "Sign in | Mnemee" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const verifyCallback = new URL("/login", window.location.origin);
    if (search.redirect?.startsWith("/") && !search.redirect.startsWith("//")) {
      verifyCallback.searchParams.set("redirect", search.redirect);
    }
    const { error } = await signIn.email({
      email,
      password,
      callbackURL: verifyCallback.href,
    });

    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        // The server has already sent a fresh verification link.
        void navigate({ to: "/verify-email", search: { email } });
        return;
      }
      setError(error.message ?? "Unable to sign in.");
      setIsSubmitting(false);
      return;
    }

    clearAuthStateCache();

    // Verify the browser accepted the session cookie before navigating. Route
    // invalidation here used to trigger a second login loader concurrently and
    // could cache a transient null session for 30 seconds.
    const destination = await getSignedInDestination();
    if (destination.to === "/login") {
      setError(
        "Sign-in succeeded, but the browser did not retain the session. Please allow cookies for this site and try again.",
      );
      setIsSubmitting(false);
      return;
    }

    clearLastLoginMethod();

    if (search.redirect?.startsWith("/") && !search.redirect.startsWith("//")) {
      void navigate({ href: search.redirect, replace: true });
      return;
    }

    void navigate({ ...destination, replace: true });
  }

  return (
    <AuthPageLayout footer={<TermsNotice />}>
      <div aria-labelledby="sign-in-title">
        <div className="space-y-1.5">
          <h1
            className="text-2xl font-semibold tracking-[-0.035em]"
            id="sign-in-title"
          >
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground">
            Continue to your workspace.
          </p>
        </div>
        <GoogleSignIn redirect={search.redirect} showLastUsed />
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
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
            />
          </div>
          <div>
            <PasswordField
              label="Password"
              labelAction={
                <Link
                  className="text-sm text-muted-foreground transition-colors duration-150 ease-[ease] hover:text-foreground"
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
              }
              id="password"
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
            <AuthError message={error} />
          </div>
          <AuthActionButton disabled={isSubmitting} type="submit">
            <span>{isSubmitting ? "Signing in" : "Sign in"}</span>
          </AuthActionButton>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            className="font-medium text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 ease-[ease] hover:decoration-current"
            to="/signup"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
