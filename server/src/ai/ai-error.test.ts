import { describe, expect, it } from "vitest";

import { describeAiError } from "@/ai/ai-error";

describe("describeAiError", () => {
  it("names usage limits from the provider's status or message", () => {
    expect(
      describeAiError(Object.assign(new Error("x"), { status: 429 })),
    ).toBe("AI usage limit reached. Try again later.");
    expect(
      describeAiError(
        new Error(
          "[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota",
        ),
      ),
    ).toBe("AI usage limit reached. Try again later.");
  });

  it("names an overloaded model", () => {
    expect(
      describeAiError(
        new Error("[503 Service Unavailable] The model is overloaded"),
      ),
    ).toBe("The AI model is overloaded right now. Try again in a moment.");
    expect(
      describeAiError(Object.assign(new Error("Overloaded"), { status: 529 })),
    ).toBe("The AI model is overloaded right now. Try again in a moment.");
  });

  it("falls back to a generic message", () => {
    expect(describeAiError(new Error("socket hang up"))).toBe(
      "AI generation failed.",
    );
  });
});
