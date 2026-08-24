import { describe, expect, it } from "vitest";

import { ApiError, getUserFacingApiErrorMessage } from "@/lib/api";

describe("getUserFacingApiErrorMessage", () => {
  it("does not expose raw validation payloads", () => {
    const rawMessage = '[{"origin":"string","code":"too_big","maximum":10000}]';

    expect(
      getUserFacingApiErrorMessage(
        new ApiError(400, rawMessage, "validation_error"),
        "Could not save note.",
      ),
    ).toBe("The provided information is invalid.");
  });

  it("uses the caller fallback for unknown errors", () => {
    expect(
      getUserFacingApiErrorMessage(new Error("private error"), "Try again."),
    ).toBe("Try again.");
  });
});
