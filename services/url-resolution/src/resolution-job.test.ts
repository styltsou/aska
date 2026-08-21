import { describe, expect, it } from "vitest";

import {
  parseUrlResolutionJob,
  urlResolutionJob,
} from "../../url-unfurl-shared/src/resolution-job";

describe("URL resolution queue contract", () => {
  it("round-trips a versioned command", () => {
    const job = urlResolutionJob(12, 4);
    expect(parseUrlResolutionJob(job)).toEqual(job);
  });

  it("rejects unknown or malformed commands", () => {
    expect(() =>
      parseUrlResolutionJob({
        version: 1,
        kind: "other-task",
        attemptId: 12,
        generation: 4,
      }),
    ).toThrow("Invalid URL resolution job");
  });
});
