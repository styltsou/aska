export type GradientNamingJob = {
  version: 1;
  kind: "gradient.name";
  assetId: number;
  fingerprint: string;
  expectedTitle: string;
  expectedManual: boolean;
};

export function parseGradientNamingJob(value: unknown): GradientNamingJob {
  if (!value || typeof value !== "object")
    throw new Error("Invalid naming job");
  const job = value as Partial<GradientNamingJob>;
  if (
    job.version !== 1 ||
    job.kind !== "gradient.name" ||
    !Number.isSafeInteger(job.assetId) ||
    typeof job.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(job.fingerprint) ||
    typeof job.expectedTitle !== "string" ||
    typeof job.expectedManual !== "boolean"
  )
    throw new Error("Invalid naming job");
  return job as GradientNamingJob;
}
