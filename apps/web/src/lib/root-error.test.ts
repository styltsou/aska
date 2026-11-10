import { describe, expect, it } from "vitest";

import { ApiError } from "./api";
import { formatRootErrorDetails, getRootErrorContent } from "./root-error";

describe("getRootErrorContent", () => {
  it("names the image view and provides a route out of a render failure", () => {
    expect(
      getRootErrorContent(
        new TypeError("Cropper failed"),
        "/work/collections/photos/asset/image-68",
      ),
    ).toMatchObject({
      title: "This image view hit a problem",
      backPath: "/work/collections/photos",
      backLabel: "Back to board",
      signIn: false,
    });
  });

  it("distinguishes a missing asset from a client crash", () => {
    const content = getRootErrorContent(
      new ApiError(404, "Not found", "not_found"),
      "/work/inbox/asset/note-1",
    );

    expect(content.title).toBe("Couldn't load this note");
    expect(content.description).toContain("moved or deleted");
    expect(content.backPath).toBe("/work/inbox");
  });

  it("offers sign-in for an expired session", () => {
    expect(
      getRootErrorContent(new ApiError(401, "Unauthorized"), "/work"),
    ).toMatchObject({
      signIn: true,
      title: "Couldn't load this page",
    });
  });
});

describe("formatRootErrorDetails", () => {
  it("includes the route and error without a query string", () => {
    expect(
      formatRootErrorDetails(
        new Error("Cropper failed"),
        "/work/asset/image-68",
        "2026-09-28T00:00:00.000Z",
      ),
    ).toContain(
      "Page: /work/asset/image-68\nTime: 2026-09-28T00:00:00.000Z\nError: Error: Cropper failed",
    );
  });
});
