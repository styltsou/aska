export type UrlResolutionJob = {
  version: 1;
  kind: "external-resource.resolve";
  attemptId: number;
  generation: number;
};

export function urlResolutionJob(
  attemptId: number,
  generation: number,
): UrlResolutionJob {
  return {
    version: 1,
    kind: "external-resource.resolve",
    attemptId,
    generation,
  };
}

export function parseUrlResolutionJob(value: unknown): UrlResolutionJob {
  if (!value || typeof value !== "object")
    throw new Error("Invalid URL resolution job");
  const candidate = value as Partial<UrlResolutionJob>;
  if (
    candidate.version !== 1 ||
    candidate.kind !== "external-resource.resolve" ||
    !Number.isSafeInteger(candidate.attemptId) ||
    !Number.isSafeInteger(candidate.generation)
  )
    throw new Error("Invalid URL resolution job");
  return candidate as UrlResolutionJob;
}
