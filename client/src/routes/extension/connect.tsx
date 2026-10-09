import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";

import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

type ExtensionConnectSearch = {
  request?: string;
  secret?: string;
};

export const Route = createFileRoute("/extension/connect")({
  validateSearch: (search): ExtensionConnectSearch => ({
    request: typeof search.request === "string" ? search.request : undefined,
    secret: typeof search.secret === "string" ? search.secret : undefined,
  }),
  head: () => ({
    meta: [{ title: "Connect extension | Aska" }],
  }),
  component: ExtensionConnectPage,
});

function ExtensionConnectPage() {
  const search = Route.useSearch();
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<"idle" | "approving" | "approved">("idle");
  const [error, setError] = useState<string | null>(null);

  const validRequest = Boolean(search.request && search.secret);

  async function approve() {
    if (!search.request || !search.secret) return;

    setError(null);
    setStatus("approving");

    try {
      await apiPost(
        `/api/v1/extension/auth/requests/${search.request}/approve`,
        { secret: search.secret },
      );
      setStatus("approved");
    } catch {
      setError("This connection request has expired. Return to the extension and start again.");
      setStatus("idle");
    }
  }

  if (!validRequest) {
    return (
      <AuthPageLayout>
        <ConnectMessage
          title="This connection link is invalid."
          description="Return to the Aska extension and start the connection again."
        />
      </AuthPageLayout>
    );
  }

  if (isPending) {
    return (
      <AuthPageLayout>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Checking your session…
        </div>
      </AuthPageLayout>
    );
  }

  if (!session) {
    return (
      <AuthPageLayout>
        <ConnectMessage
          title="Sign in to connect the extension."
          description="You’ll return here to approve the connection."
        >
          <Button
            render={
              <Link
                to="/login"
                search={{
                  redirect: `/extension/connect?request=${encodeURIComponent(search.request!)}&secret=${encodeURIComponent(search.secret!)}`,
                }}
              />
            }
          >
            Sign in
          </Button>
        </ConnectMessage>
      </AuthPageLayout>
    );
  }

  if (status === "approved") {
    return (
      <AuthPageLayout>
        <ConnectMessage
          title="Aska extension connected."
          description="You can close this tab and return to the extension."
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckIcon className="size-4" />
            Connection approved
          </div>
        </ConnectMessage>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <ConnectMessage
        title="Connect the Aska extension?"
        description="This gives the extension its own secure credential for your Aska account."
      >
        <Button disabled={status === "approving"} onClick={() => void approve()}>
          {status === "approving" ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : null}
          {status === "approving" ? "Connecting" : "Connect extension"}
        </Button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </ConnectMessage>
    </AuthPageLayout>
  );
}

function ConnectMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-6" aria-labelledby="extension-connect-title">
      <div className="space-y-1.5">
        <h1
          className="text-2xl font-semibold tracking-[-0.035em]"
          id="extension-connect-title"
        >
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
