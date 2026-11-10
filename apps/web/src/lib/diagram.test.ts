import { describe, expect, it } from "vitest";
import { parseMermaidFence } from "./diagram";

describe("parseMermaidFence", () => {
  it("recognizes a complete Mermaid code fence", () => {
    expect(parseMermaidFence("```mermaid\nflowchart LR\n  A --> B\n```")).toBe(
      "flowchart LR\n  A --> B",
    );
    expect(
      parseMermaidFence("~~~mermaid\nsequenceDiagram\n  A->>B: Hi\n~~~"),
    ).toBe("sequenceDiagram\n  A->>B: Hi");
  });

  it("leaves other code and partial Markdown alone", () => {
    expect(parseMermaidFence("```ts\nconst x = 1\n```")).toBeUndefined();
    expect(
      parseMermaidFence("Before\n```mermaid\ngraph LR\nA-->B\n```"),
    ).toBeUndefined();
  });
});
