import { describe, expect, it } from "vitest";

import { composeFrontMatter, parseFrontMatter } from "./front-matter";

describe("parseFrontMatter", () => {
  it("returns the document untouched when there is no front matter", () => {
    const markdown = "# Hello\n\nBody with --- hr\n";
    expect(parseFrontMatter(markdown)).toEqual({
      raw: "",
      data: {},
      body: markdown,
    });
  });

  it("does not treat a mid-document rule as front matter", () => {
    const markdown = "Intro\n\n---\n\nAfter\n";
    expect(parseFrontMatter(markdown).raw).toBe("");
  });

  it("requires the fence at position zero", () => {
    const markdown = "\n---\ntitle: x\n---\n";
    expect(parseFrontMatter(markdown).raw).toBe("");
  });

  it("parses scalar keys and preserves raw bytes", () => {
    const source = "---\ntitle: My note\ndate: 2026-08-21\n---\n\nBody\n";
    const parsed = parseFrontMatter(source);

    expect(parsed.raw).toBe("---\ntitle: My note\ndate: 2026-08-21\n---\n");
    expect(parsed.data).toEqual({ title: "My note", date: "2026-08-21" });
    expect(parsed.body).toBe("\nBody\n");
  });

  it("unquotes values and splits inline lists", () => {
    const parsed = parseFrontMatter(
      '---\nsource: "https://example.com"\ntags: [a, "b c", d]\n---\n',
    );

    expect(parsed.data).toEqual({
      source: "https://example.com",
      tags: ["a", "b c", "d"],
    });
  });

  it("parses dash-style lists", () => {
    const parsed = parseFrontMatter("---\ntags:\n  - one\n  - two\n---\n");

    expect(parsed.data).toEqual({ tags: ["one", "two"] });
  });

  it("handles CRLF documents", () => {
    const parsed = parseFrontMatter("---\r\ntitle: x\r\n---\r\nbody");

    expect(parsed.raw).toBe("---\r\ntitle: x\r\n---\r\n");
    expect(parsed.body).toBe("body");
  });

  it("ignores comments and malformed lines", () => {
    const parsed = parseFrontMatter(
      "---\n# heading\nnot a pair\nok: yes\n---\n",
    );

    expect(parsed.data).toEqual({ ok: "yes" });
  });

  it("round-trips through composeFrontMatter", () => {
    const source = "---\ntags: [a, b]\n---\n\nEdited body\n";
    const parsed = parseFrontMatter(source);

    expect(composeFrontMatter(parsed, parsed.body)).toBe(source);
    expect(composeFrontMatter(parsed, "New body")).toBe(
      "---\ntags: [a, b]\n---\nNew body",
    );
  });
});
