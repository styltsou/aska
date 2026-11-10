import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

export function GoogleSignIn({ redirect }: { redirect?: string }) {
  const [pending, setPending] = useState(false);
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
    const callbackURL =
      destination?.origin === window.location.origin
        ? destination.href
        : window.location.origin + "/";
    try {
      const result = await signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL: window.location.origin + "/login?error=google",
      });
      if (result.error) {
        setError(result.error.message ?? "Google sign-in is unavailable.");
        setPending(false);
      }
    } catch {
      setError("Google sign-in is unavailable. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <Button
        className="h-10 w-full"
        variant="outline"
        type="button"
        disabled={pending}
        onClick={handleSignIn}
      >
        {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
        Continue with Google
      </Button>
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
