import type { APIGatewayProxyEvent } from "aws-lambda";
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

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEvent, responseStream) => {
    const origin = event.headers.origin ?? event.headers.Origin;
    const headers = responseHeaders(origin);
    const respond = (statusCode: number, contentType: string) =>
      awslambda.HttpResponseStream.from(responseStream, {
        statusCode,
        headers: { ...headers, "Content-Type": contentType },
      });
    const respondJson = (statusCode: number, body: string) => {
      const stream = respond(statusCode, "application/json");
      stream.write(body);
      stream.end();
    };

    if (event.httpMethod === "OPTIONS") {
      const stream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: origin && allowedOrigins.has(origin) ? 200 : 403,
        headers: {
          ...headers,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
      stream.write("ok");
      stream.end();
      return;
    }

    if (
      event.httpMethod !== "POST" ||
      (origin && !allowedOrigins.has(origin))
    ) {
      respondJson(403, '{"error":"Forbidden"}');
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
      respondJson(503, '{"error":"AI is unavailable"}');
      return;
    }
    if (!session?.user) {
      respondJson(401, '{"error":"Unauthorized"}');
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
      respondJson(400, '{"error":"Invalid prompt or note"}');
      return;
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      respondJson(503, '{"error":"AI is unavailable"}');
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
  },
);
