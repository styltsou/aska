import type { APIGatewayProxyEvent } from "aws-lambda";
import { z } from "zod";

import { describeAgentError } from "@/agent/agent-error";
import type { AgentReference } from "@/agent/note-agent";
import { configureEnv } from "@/config/env";

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
);
// The whole note is sent; mentioned items are sent as IDs and loaded here,
// from the workspace the user is a member of. The model only sees an overview
// of anything long, and reads the rest through tools as needed.
const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  note: z.string().max(200_000),
  task: z.enum(["write", "rewrite", "mechanical"]).optional(),
  draft: z.string().max(40000).optional(),
  earlierPrompts: z.array(z.string().max(4000)).max(10).optional(),
  passage: z.string().max(40000).optional(),
  workspaceSlug: z.string().trim().min(1).max(200).optional(),
  mentions: z
    .array(
      z.object({
        assetId: z.number().int().positive(),
        // Mirrors MENTIONABLE_TYPES (agent/mentioned-assets.ts), which can't be
        // imported here before the env is configured. Requests saved before
        // types existed only mentioned notes.
        type: z.enum(["note", "link", "color"]).default("note"),
      }),
    )
    .max(3)
    .optional(),
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
      console.error("Agent note stream initialization failed", error);
      respondJson(503, '{"error":"AI is unavailable"}');
      return;
    }
    if (!session?.user) {
      respondJson(401, '{"error":"Unauthorized"}');
      return;
    }

    let request: z.infer<typeof requestSchema>;
    try {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : event.body;
      const parsed = JSON.parse(body ?? "");
      request = requestSchema.parse(parsed.input ?? parsed);
    } catch {
      respondJson(400, '{"error":"Invalid prompt or note"}');
      return;
    }

    const { createNoteModel } = await import("@/agent/note-model");
    const model = createNoteModel();
    if (!model) {
      respondJson(503, '{"error":"AI is unavailable"}');
      return;
    }

    const { mentions, workspaceSlug, ...input } = request;
    let references: AgentReference[] | undefined;
    if (mentions?.length) {
      if (!workspaceSlug) {
        respondJson(400, '{"error":"Mentions need a workspace"}');
        return;
      }
      try {
        const { loadMentions } = await import("@/agent/mentioned-assets");
        references = await loadMentions(
          workspaceSlug,
          session.user.id,
          mentions,
        );
      } catch (error) {
        console.error("Loading mentions failed", error);
        respondJson(503, '{"error":"Could not load the mentioned items"}');
        return;
      }
    }

    const stream = respond(200, "text/event-stream; charset=utf-8");
    const send = (name: string, data: unknown) => {
      stream.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const { runNoteAgent } = await import("@/agent/note-agent");
      for await (const event of runNoteAgent(
        references?.length ? { ...input, references } : input,
        model,
      )) {
        if (event.type === "text") {
          send("custom", { type: "delta", text: event.text });
        } else if (event.type === "status") {
          send("custom", { type: "status", text: event.text });
        }
      }
      send("custom", { type: "done" });
    } catch (error) {
      console.error("Agent note stream failed", error);
      send("error", { message: describeAgentError(error) });
    } finally {
      stream.end();
    }
  },
);
