import { describe, expect, it } from "vitest";
import { classifyDiagramPaste } from "./diagram";

describe("classifyDiagramPaste", () => {
  it("recognizes fenced Mermaid for direct creation", () => {
    expect(
      classifyDiagramPaste("```mermaid\nflowchart LR\n  A --> B\n```"),
    ).toEqual({ source: "flowchart LR\n  A --> B", confidence: "fenced" });
  });

  it("recognizes plain Mermaid but requires confirmation", () => {
    expect(classifyDiagramPaste("sequenceDiagram\n  A->>B: Hello")).toEqual({
      source: "sequenceDiagram\n  A->>B: Hello",
      confidence: "plain",
    });
  });

  it("leaves ordinary text alone", () => {
    expect(
      classifyDiagramPaste("A thought about diagrams\nwith another line"),
    ).toBeUndefined();
  });
});
