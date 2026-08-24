import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/response";
import { validate } from "@/middleware/validate";

describe("validation middleware", () => {
  it("does not expose serialized Zod issues", async () => {
    const app = new Hono();
    app.onError((error, c) => {
      if (error instanceof AppError) {
        return c.json(errorResponse(error.code, error.message), error.status);
      }
      return c.json({ error: { code: "internal_error" } }, 500);
    });
    app.post(
      "/",
      validate.body(z.object({ content: z.string().max(2) })),
      (c) => c.json({ ok: true }),
    );

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "too long" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "validation_error",
        message: "The request contains invalid data.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("too_big");
  });
});
