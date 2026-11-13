import { useEffect, useState } from "react";
import { AvatarPicker } from "@/components/auth/avatar-picker";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AccountSettings() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).has("googleLinkError")
      ? "Unable to connect Google. Make sure its email matches your account and try again."
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    void authClient
      .listAccounts()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message ?? "Unable to load sign-in methods.");
        else
          setLinked(!!data?.some((account) => account.providerId === "google"));
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load sign-in methods.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function linkGoogle() {
    setPending(true);
    setError(null);
    try {
      const errorURL = new URL(window.location.href);
      errorURL.searchParams.set("googleLinkError", "1");
      const { error } = await authClient.linkSocial({
        provider: "google",
        callbackURL: window.location.href,
        errorCallbackURL: errorURL.href,
      });
      if (error) {
        setError(error.message ?? "Unable to connect Google.");
        setPending(false);
      }
    } catch {
      setError("Unable to connect Google. Please try again.");
      setPending(false);
    }
  }

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold tracking-tight">Account</h2>
      <AvatarPicker googleLinked={linked === true} />
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Google sign-in</h3>
          <p className="text-sm text-muted-foreground">
            Connect a Google account with the same email address to sign in with
            Google.
          </p>
        </div>
        {linked === true ? <p className="text-sm">Connected</p> : null}
        {linked === false ? (
          <Button variant="outline" onClick={linkGoogle} disabled={pending}>
            {pending ? "Connecting…" : "Connect Google"}
          </Button>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
