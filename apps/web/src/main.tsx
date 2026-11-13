import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { authHistoryTransitionTypes } from "@/components/auth/auth-view-transition";
import { initializeSentry } from "@/lib/sentry";
import { routeTree } from "./routeTree.gen";
import { synchronizeGridCaches } from "@/api/collection/grid-cache";
import { AUTH_MOCK_ENABLED, installAuthMock } from "@/dev/auth-mock";

import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A missing or inaccessible resource will not become available on a
      // second request, so render its recovery state immediately. Transient
      // network and server failures get one quick automatic retry.
      retry: (failureCount, error) => {
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }

        return failureCount < 1;
      },
      retryDelay: 1_000,
    },
  },
});
synchronizeGridCaches(queryClient);
const router = createRouter({
  routeTree,
  notFoundMode: "root",
  defaultPreload: "intent",
  defaultPendingMinMs: 0,
  defaultViewTransition:
    "startViewTransition" in document &&
    CSS.supports("selector(:active-view-transition-type(auth-switch))")
      ? {
          types: ({ fromLocation, toLocation, pathChanged }) =>
            pathChanged
              ? authHistoryTransitionTypes(
                  fromLocation?.pathname,
                  toLocation.pathname,
                  fromLocation?.state.__TSR_index,
                  toLocation.state.__TSR_index,
                )
              : false,
        }
      : false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

initializeSentry(router);

// Dev only: answer the auth API from an in-browser mock (see src/dev/auth-mock).
if (AUTH_MOCK_ENABLED) installAuthMock(router);

createRoot(document.getElementById("root")!, {
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
  onUncaughtError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
