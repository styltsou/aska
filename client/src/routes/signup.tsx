import { useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  UserPlusIcon,
} from "lucide-react";
import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { clearAuthStateCache, redirectIfSignedIn } from "@/lib/auth-flow";
import { signUp } from "@/lib/auth-client";

export const Route = createFileRoute("/signup")({
  beforeLoad: redirectIfSignedIn,
  head: () => ({
    meta: [{ title: "Create account | Aska" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    });

    if (error) {
      setError(error.message ?? "Unable to create your account.");
      setIsSubmitting(false);
      return;
    }

    clearAuthStateCache();
    await router.invalidate();
    void navigate({ to: "/onboarding", replace: true });
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
                autoComplete="new-password"
                id="password"
                minLength={8}
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
          <Field className="gap-2">
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <InputGroup className="h-10">
              <InputGroupInput
                className="h-10 px-3"
                autoComplete="new-password"
                id="confirm-password"
                minLength={8}
                required
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <InputGroupAddon align="end">
                <button
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
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
              <UserPlusIcon />
            )}
            <span>{isSubmitting ? "Creating account" : "Create account"}</span>
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
