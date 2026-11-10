import { describe, expect, it } from "vitest";

import { shouldRenderWithoutAppShell } from "./root-shell";

describe("root shell routing", () => {
  it("keeps the app shell during a workspace match gap", () => {
    expect(
      shouldRenderWithoutAppShell(undefined, "/testing/collections/testing"),
    ).toBe(false);
  });

  it("keeps auth and onboarding routes shellless before their match appears", () => {
    expect(shouldRenderWithoutAppShell(undefined, "/login")).toBe(true);
    expect(shouldRenderWithoutAppShell(undefined, "/signup/")).toBe(true);
    expect(shouldRenderWithoutAppShell(undefined, "/onboarding")).toBe(true);
  });

  it("uses the committed match while a destination is pending", () => {
    expect(shouldRenderWithoutAppShell("/$workspaceSlug", "/login")).toBe(
      false,
    );
    expect(shouldRenderWithoutAppShell("/login", "/testing")).toBe(true);
  });
});
