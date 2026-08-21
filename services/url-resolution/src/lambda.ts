import { initializeSentry } from "../../image-shared/src/observability";
import { callPipeline } from "../../image-shared/src/pipeline-client";
import { createTaskHandler } from "../../image-shared/src/task-handler";
import { parseUrlResolutionJob } from "../../url-unfurl-shared/src/resolution-job";
import { SafeFetchError } from "../../url-unfurl-shared/src/safe-fetch";
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
  return parseUrlResolutionJob(JSON.parse(body));
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
