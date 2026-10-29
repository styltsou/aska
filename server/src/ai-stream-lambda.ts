import type { APIGatewayProxyEvent } from "aws-lambda";
import type { Writable } from "node:stream";
import { z } from "zod";

import { configureEnv } from "@/config/env";

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
);
const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  note: z.string().max(40000),
});

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

export async function handler(
  event: APIGatewayProxyEvent,
  responseStream: Writable,
) {
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

  if (event.httpMethod !== "POST" || (origin && !allowedOrigins.has(origin))) {
    respond(403, "application/json").end('{"error":"Forbidden"}');
    return;
  }

  let session;
  try {
    configureEnv(process.env as Record<string, unknown>);
    const { auth } = await import("@/lib/auth");
    session = await auth.api.getSession({
      headers: new Headers({
        cookie: event.headers.cookie ?? event.headers.Cookie ?? "",
      }),
    });
  } catch (error) {
    console.error("AI note stream initialization failed", error);
    respond(503, "application/json").end('{"error":"AI is unavailable"}');
    return;
  }
  if (!session?.user) {
    respond(401, "application/json").end('{"error":"Unauthorized"}');
    return;
  }

  let input: z.infer<typeof requestSchema>;
  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf8")
      : event.body;
    const request = JSON.parse(body ?? "");
    input = requestSchema.parse(request.input ?? request);
  } catch {
    respond(400, "application/json").end('{"error":"Invalid prompt or note"}');
    return;
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    respond(503, "application/json").end('{"error":"AI is unavailable"}');
    return;
  }

  const stream = respond(200, "text/event-stream; charset=utf-8");
  const send = (name: string, data: unknown) => {
    stream.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    const { createNoteEditGraph } = await import("@/ai/note-graph");
    const graph = createNoteEditGraph(apiKey);
    for await (const [chunk] of await graph.stream(input, {
      streamMode: "messages",
    })) {
      const text =
        typeof chunk.content === "string"
          ? chunk.content
          : chunk.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("");
      if (text) send("custom", { type: "delta", text });
    }
    send("custom", { type: "done" });
  } catch (error) {
    console.error("AI note stream failed", error);
    send("error", { message: "AI generation failed" });
  } finally {
    stream.end();
  }
}
