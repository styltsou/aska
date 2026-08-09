import {
  createRootRoute,
  HeadContent,
  Outlet,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: "Aska" }],
  }),
  component: RootLayout,
  pendingComponent: RootPending,
  errorComponent: RootError,
});

const SHELLLESS_ROUTE_IDS = new Set(["/login", "/signup", "/onboarding"]);

function RootLayout() {
  // Base the shell decision on the *committed* match tree rather than the
  // optimistic `pathname`. The pathname updates to the destination URL the
  // moment navigation starts, but the Outlet keeps rendering the previous
  // committed route until the new one resolves. Reading the committed matches
  // avoids flashing a full auth page (e.g. the AuthPageLayout) inside the app
  // shell while a signed-in workspace route loads.
  const isShelllessRoute = useRouterState({
    select: (state) => {
      const topLevel = state.matches[1];
      return topLevel ? SHELLLESS_ROUTE_IDS.has(topLevel.routeId) : true;
    },
  });

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

function RootError({ reset }: ErrorComponentProps) {
  return (
    <ThemeProvider>
      <div className="flex min-h-svh items-center justify-center bg-background px-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold">We couldn’t open Aska</h1>
          <p className="text-sm text-muted-foreground">
            Your session may have expired, or the service may be temporarily
            unavailable. Please try again.
          </p>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            onClick={() => {
              reset();
              window.location.reload();
            }}
          >
            Try again
          </button>
        </div>
      </div>
    </ThemeProvider>
  );
}
