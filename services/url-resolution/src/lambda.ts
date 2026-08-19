import { initializeSentry } from "../../image-shared/src/observability";
import { callPipeline } from "../../url-unfurl-shared/src/pipeline-client";
import { SafeFetchError } from "../../url-unfurl-shared/src/safe-fetch";
import { createTaskHandler } from "../../url-unfurl-shared/src/task-handler";
import { GenericHtmlResolver } from "./generic-resolver";
import { resolveWithRegistry } from "./types";

initializeSentry("url-resolution");

type Task = { attemptId: number; generation: number };
type Claim =
  | { ignored: true }
  | {
      ignored: false;
      attemptId: number;
      generation: number;
      url: string;
      resolverKey: string;
      resolverVersion: string;
    };

const resolvers = [new GenericHtmlResolver()] as const;

function parseTask(body: string): Task {
  const parsed = JSON.parse(body) as Partial<Task>;
  if (
    !Number.isSafeInteger(parsed.attemptId) ||
    !Number.isSafeInteger(parsed.generation)
  )
    throw new Error("Invalid URL resolution task");
  return { attemptId: parsed.attemptId!, generation: parsed.generation! };
}

async function processTask(task: Task) {
  const claim = await callPipeline<Claim>(
    "/api/v1/internal/url-resolution/claim",
    { id: task.attemptId, generation: task.generation },
  );
  if (claim.ignored) return;
  const result = await resolveWithRegistry(new URL(claim.url), resolvers);
  await callPipeline("/api/v1/internal/url-resolution/result", {
    event: "resource.metadata.completed",
    id: task.attemptId,
    generation: task.generation,
    ...result,
  });
}

async function reportFailure(task: Task, error: unknown) {
  const safe = error instanceof SafeFetchError ? error : undefined;
  await callPipeline("/api/v1/internal/url-resolution/result", {
    event: "resource.metadata.failed",
    id: task.attemptId,
    generation: task.generation,
    failureCategory: safe?.category ?? "resolver_error",
    diagnosticCode: safe?.category ?? "unexpected_resolver_error",
    httpStatus: safe?.httpStatus ?? null,
  });
}

export const handler = createTaskHandler({
  pipeline: "url-resolution",
  parse: parseTask,
  process: processTask,
  reportTerminalFailure: reportFailure,
});
