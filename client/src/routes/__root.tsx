import {
  createRootRoute,
  HeadContent,
  Outlet,
  useRouterState,
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
});

function RootLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isShelllessRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding";

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
