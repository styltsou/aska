import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheckIcon, LoaderCircleIcon } from "lucide-react";
import { AvatarPicker } from "@/components/auth/avatar-picker";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AccountSettings() {
  const { data: session } = authClient.useSession();
  const accounts = useQuery({
    queryKey: ["auth", "linked-accounts", session?.user.id],
    enabled: !!session?.user.id,
    staleTime: 60_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error } = await authClient.listAccounts({
        fetchOptions: { signal },
      });
      if (error)
        throw new Error(error.message ?? "Unable to load sign-in methods.");
      return data?.some((account) => account.providerId === "google") ?? false;
    },
  });
  const linked = accounts.data;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).has("googleLinkError")
      ? "Unable to connect Google. Make sure its email matches your account and try again."
      : null,
  );

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
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Account</h2>
      <div className="mt-9">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Profile
        </h3>
        <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card">
          <AvatarPicker />
        </div>
      </div>
      <div className="mt-9">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Sign-in
        </h3>
        <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card">
          <div className="bg-card px-4 py-4 sm:px-5">
            <h4 className="text-sm font-medium">Google sign-in</h4>
            <p className="text-sm text-muted-foreground">
              Connect a Google account with the same email address to sign in
              with Google.
            </p>
          </div>
          <div className="space-y-3 rounded-t-lg border-t border-border/70 bg-background px-4 py-4 sm:px-5">
            <div
              className="flex min-h-8 items-center"
              role="status"
              aria-live="polite"
            >
              {accounts.isPending ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="size-4 motion-safe:animate-spin"
                  />
                  Checking connection…
                </p>
              ) : null}
              {linked === true ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CircleCheckIcon aria-hidden="true" className="size-4" />
                  Connected
                </p>
              ) : null}
              {linked === false ? (
                <Button
                  variant="outline"
                  onClick={linkGoogle}
                  disabled={pending}
                >
                  {pending ? (
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="size-4 motion-safe:animate-spin"
                    />
                  ) : null}
                  {pending ? "Connecting…" : "Connect Google"}
                </Button>
              ) : null}
              {accounts.isError && linked === undefined ? (
                <Button
                  variant="outline"
                  onClick={() => void accounts.refetch()}
                >
                  Retry
                </Button>
              ) : null}
            </div>
            {error || accounts.error ? (
              <p className="text-sm text-destructive" role="alert">
                {error ?? accounts.error?.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
