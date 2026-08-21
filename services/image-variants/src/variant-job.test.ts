import { describe, expect, it } from "vitest";

import {
  parseResourceMediaRenditionJob,
  resourceMediaRenditionJob,
} from "../../image-shared/src/variant-job";

describe("image variants queue contract", () => {
  it("round-trips a resource media rendition command", () => {
    const job = resourceMediaRenditionJob(42, 3);
    expect(parseResourceMediaRenditionJob(job)).toEqual(job);
  });

  it("leaves S3 notifications for the upload event adapter", () => {
    expect(parseResourceMediaRenditionJob({ Records: [] })).toBeUndefined();
  });

  it("rejects malformed recognized commands", () => {
    expect(() =>
      parseResourceMediaRenditionJob({
        version: 1,
        kind: "resource-media.render",
        mediaId: "42",
        generation: 3,
      }),
    ).toThrow("Invalid resource media rendition job");
  });
});
