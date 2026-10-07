import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useState } from "react";
import { CircleAlertIcon, CopyIcon, RotateCwIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { NotFoundPage } from "@/components/not-found-page";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { formatRootErrorDetails, getRootErrorContent } from "@/lib/root-error";
import { shouldRenderWithoutAppShell } from "@/lib/root-shell";

export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: "Aska" }],
  }),
  component: RootLayout,
  pendingComponent: RootPending,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
});

function RootLayout() {
  const isGlobalNotFound = useRouterState({
    select: (state) => state.matches[0]?.globalNotFound ?? false,
  });

  // Prefer the committed match while navigating. During a brief match gap,
  // fall back to the committed pathname so a workspace Outlet keeps its
  // providers instead of being treated as a shellless route.
  const isShelllessRoute = useRouterState({
    select: (state) => {
      const topLevel = state.matches[1];
      return shouldRenderWithoutAppShell(
        topLevel?.routeId,
        (state.resolvedLocation ?? state.location).pathname,
      );
    },
  });

  if (isGlobalNotFound) {
    return (
      <ThemeProvider>
        <NotFoundPage />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <HeadContent />
      <Toaster />
      {isShelllessRoute ? (
        <Outlet />
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
    </ThemeProvider>
  );
}

function RootPending() {
  return (
    <ThemeProvider>
      <div className="flex min-h-svh items-center justify-center bg-background px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    </ThemeProvider>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const content = getRootErrorContent(error, pathname);

  return (
    <ThemeProvider>
      <main className="relative grid min-h-svh place-items-center bg-background px-6 py-16">
        <BrandLogo className="absolute top-6 left-6" />
        <section className="w-full max-w-lg" role="alert">
          <CircleAlertIcon
            aria-hidden="true"
            className="mb-5 size-9 text-muted-foreground"
            strokeWidth={1.25}
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            {content.title}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {content.description}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                reset();
                window.location.reload();
              }}
            >
              <RotateCwIcon />
              Try again
            </Button>
            <Button
              variant="secondary"
              render={
                <Link to={content.signIn ? "/login" : content.backPath} />
              }
            >
              {content.signIn ? "Sign in" : content.backLabel}
            </Button>
          </div>
          {import.meta.env.DEV ? (
            <RootErrorDiagnostics error={error} pathname={pathname} />
          ) : null}
        </section>
      </main>
    </ThemeProvider>
  );
}

function RootErrorDiagnostics({
  error,
  pathname,
}: {
  error: unknown;
  pathname: string;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [errorTime] = useState(() => new Date().toISOString());
  const errorDetails = formatRootErrorDetails(error, pathname, errorTime);

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <details className="mt-10 border-t border-border pt-4 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Technical details
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">
          Copy these details if you report the problem. Review them before
          sharing; they may include the page address and error text.
        </p>
        <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs leading-5 wrap-break-word whitespace-pre-wrap">
          {errorDetails}
        </pre>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copyDetails()}
        >
          <CopyIcon />
          {copyStatus === "copied" ? "Copied" : "Copy details"}
        </Button>
        {copyStatus === "failed" ? (
          <p className="text-xs text-destructive" role="status">
            Couldn’t copy automatically. You can select the details above.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function RootNotFound() {
  return (
    <ThemeProvider>
      <NotFoundPage />
    </ThemeProvider>
  );
}
