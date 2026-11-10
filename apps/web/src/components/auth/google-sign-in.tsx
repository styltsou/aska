import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import {
  beginGoogleSignIn,
  clearGoogleSignInAttempt,
  wasGoogleLastUsed,
} from "@/lib/last-login-method";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.79 7.26l7.73 6C44.39 38.11 46.98 31.97 46.98 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.75 24c0-1.59.27-3.13.77-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.72l-7.73-6C30.02 37.72 27.28 38.5 24 38.5c-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

export function GoogleSignIn({
  redirect,
  showLastUsed = false,
}: {
  redirect?: string;
  showLastUsed?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [lastUsed] = useState(() => showLastUsed && wasGoogleLastUsed());
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).has("error")
      ? "Google sign-in could not be completed. If you already have an account, verify its email or connect Google in Account settings."
      : null,
  );

  async function handleSignIn() {
    setPending(true);
    setError(null);
    // Only allow paths on this origin, including after URL normalization.
    const destination =
      redirect?.startsWith("/") && !redirect.startsWith("//")
        ? new URL(redirect, window.location.origin)
        : null;
    const callbackURL = new URL("/login", window.location.origin);
    callbackURL.searchParams.set("google", "success");
    if (destination?.origin === window.location.origin) {
      callbackURL.searchParams.set(
        "redirect",
        destination.pathname + destination.search + destination.hash,
      );
    }
    beginGoogleSignIn();
    try {
      const result = await signIn.social({
        provider: "google",
        callbackURL: callbackURL.href,
        errorCallbackURL: window.location.origin + "/login?error=google",
      });
      if (result.error) {
        clearGoogleSignInAttempt();
        setError(result.error.message ?? "Google sign-in is unavailable.");
        setPending(false);
      }
    } catch {
      clearGoogleSignInAttempt();
      setError("Google sign-in is unavailable. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="relative">
        <Button
          className="h-10 w-full"
          type="button"
          disabled={pending}
          onClick={handleSignIn}
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>
        {lastUsed ? (
          <span className="pointer-events-none absolute -top-2 right-3 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] leading-none font-medium text-foreground shadow-sm">
            Last used
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className="flex items-center gap-3 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
