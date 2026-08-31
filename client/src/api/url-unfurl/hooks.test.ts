import { describe, expect, it } from "vitest";

import { activeLinkRefetchInterval, createOptimisticLink } from "./hooks";

describe("createOptimisticLink", () => {
  it("creates an immediate usable hostname card without resolved fields", () => {
    expect(
      createOptimisticLink(
        "https://example.com/reference?id=4",
        "link-optimistic-1",
      ),
    ).toMatchObject({
      id: "link-optimistic-1",
      type: "link",
      originalUrl: "https://example.com/reference?id=4",
      hostname: "example.com",
      title: "example.com",
      resolutionStatus: "queued",
      note: null,
      previewImage: null,
      favicon: null,
      video: null,
    });
  });
});

describe("activeLinkRefetchInterval", () => {
  it("polls only while a link is queued or resolving", () => {
    expect(
      activeLinkRefetchInterval({
        nodes: [{ type: "link", resolutionStatus: "queued" }],
      }),
    ).toBe(1500);
    expect(
      activeLinkRefetchInterval({
        nodes: [{ type: "link", resolutionStatus: "partial" }],
      }),
    ).toBe(false);
  });
});
