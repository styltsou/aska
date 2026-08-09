import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon, LogInIcon } from "lucide-react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  clearAuthStateCache,
  getSignedInDestination,
  redirectIfSignedIn,
} from "@/lib/auth-flow";
import { signIn } from "@/lib/auth-client";

type AuthSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: redirectIfSignedIn,
  head: () => ({
    meta: [{ title: "Sign in | Aska" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error } = await signIn.email({
      email,
      password,
    });

    if (error) {
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

    if (search.redirect?.startsWith("/")) {
      void navigate({ href: search.redirect, replace: true });
      return;
    }

    void navigate({ ...destination, replace: true });
  }

  return (
    <AuthPageLayout>
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
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
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
          <Field className="gap-2">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <InputGroup className="h-10">
              <InputGroupInput
                className="h-10 px-3"
                autoComplete="current-password"
                id="password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <InputGroupAddon align="end">
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="h-10 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <LogInIcon />
            )}
            <span>{isSubmitting ? "Signing in" : "Sign in"}</span>
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            to="/signup"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
