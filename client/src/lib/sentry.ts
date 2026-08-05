import * as Sentry from "@sentry/react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

export function initializeSentry(router: unknown): void {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
    tracesSampleRate: readSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      0.2,
    ),
    tracePropagationTargets: [SERVER_URL],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    enableLogs: true,
    enableMetrics: true,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    initialScope: {
      tags: { service: "aska-client" },
    },
  });

  scheduleReplay();
}

function scheduleReplay(): void {
  const load = () => {
    void import("@sentry/replay")
      .then(({ replayIntegration }) => {
        Sentry.addIntegration(
          replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        );
      })
      .catch(() => {
        Sentry.logger.warn("Sentry Replay failed to load");
      });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(load, { timeout: 2_000 });
  } else {
    window.setTimeout(load, 0);
  }
}

function readSampleRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}
