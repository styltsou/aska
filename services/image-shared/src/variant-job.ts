export type ResourceMediaRenditionJob = {
  version: 1;
  kind: "resource-media.render";
  mediaId: number;
  generation: number;
};

export function resourceMediaRenditionJob(
  mediaId: number,
  generation: number,
): ResourceMediaRenditionJob {
  return { version: 1, kind: "resource-media.render", mediaId, generation };
}

export function parseResourceMediaRenditionJob(
  value: unknown,
): ResourceMediaRenditionJob | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ResourceMediaRenditionJob>;
  if (candidate.kind !== "resource-media.render") return undefined;
  if (
    candidate.version !== 1 ||
    !Number.isSafeInteger(candidate.mediaId) ||
    !Number.isSafeInteger(candidate.generation)
  )
    throw new Error("Invalid resource media rendition job");
  return candidate as ResourceMediaRenditionJob;
}
