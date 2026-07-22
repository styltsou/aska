import { useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
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
  const router = useRouter();
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
    await router.invalidate();

    if (search.redirect?.startsWith("/")) {
      void navigate({ href: search.redirect, replace: true });
      return;
    }

    const destination = await getSignedInDestination();
    void navigate({ ...destination, replace: true });
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <BrandLogo className="mb-8" />
      <div className="w-full max-w-sm space-y-1">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Continue to your workspace.
        </p>
      </div>
      <form className="mt-6 w-full max-w-sm space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            autoComplete="email"
            inputMode="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <InputGroup>
            <InputGroupInput
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
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                tabIndex={-1}
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <LogInIcon />
          )}
          <span>{isSubmitting ? "Signing in" : "Sign in"}</span>
        </Button>
      </form>
      <p className="mt-5 w-full max-w-sm text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          to="/signup"
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
