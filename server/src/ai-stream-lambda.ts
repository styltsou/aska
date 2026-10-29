import type { APIGatewayProxyEvent } from "aws-lambda";

import { configureEnv } from "@/config/env";
import { auth } from "@/lib/auth";

configureEnv(process.env as Record<string, unknown>);

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
);

function responseHeaders(origin: string | undefined) {
  return {
    ...(origin && allowedOrigins.has(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        }
      : {}),
    "Cache-Control": "no-cache, no-transform",
  };
}

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEvent, responseStream) => {
    const origin = event.headers.origin ?? event.headers.Origin;
    const headers = responseHeaders(origin);
    const respond = (statusCode: number, contentType: string) =>
      awslambda.HttpResponseStream.from(responseStream, {
        statusCode,
        headers: { ...headers, "Content-Type": contentType },
      });

    if (event.httpMethod === "OPTIONS") {
      const stream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: origin && allowedOrigins.has(origin) ? 204 : 403,
        headers: {
          ...headers,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
      stream.end();
      return;
    }

    if (
      event.httpMethod !== "POST" ||
      (origin && !allowedOrigins.has(origin))
    ) {
      respond(403, "application/json").end('{"error":"Forbidden"}');
      return;
    }

    const session = await auth.api.getSession({
      headers: new Headers({
        cookie: event.headers.cookie ?? event.headers.Cookie ?? "",
      }),
    });
    if (!session?.user) {
      respond(401, "application/json").end('{"error":"Unauthorized"}');
      return;
    }

    // A small deployment probe; model output will use this same stream.
    const stream = respond(200, "text/event-stream; charset=utf-8");
    stream.write("event: ready\ndata: {}\n\n");
    await new Promise((resolve) => setTimeout(resolve, 300));
    stream.end("event: done\ndata: {}\n\n");
  },
);
