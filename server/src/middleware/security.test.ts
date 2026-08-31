import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { securityHeaders } from "./security";

function createApp() {
  return new Hono().use("*", securityHeaders).get("*", (c) => c.text("ok"));
}

describe("security headers", () => {
  it("allows only the privacy-enhanced YouTube host for application frames", async () => {
    const response = await createApp().request("/");
    const policy = response.headers.get("Content-Security-Policy");
    const frameDirective = policy
      ?.split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("frame-src"));

    expect(frameDirective).toBe("frame-src https://www.youtube-nocookie.com");
  });

  it("does not grant frame access on the documentation route", async () => {
    const response = await createApp().request("/docs");

    expect(response.headers.get("Content-Security-Policy")).not.toContain(
      "frame-src",
    );
  });
});
