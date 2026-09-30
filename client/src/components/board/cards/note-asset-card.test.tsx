import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NoteMarkdown } from "./note-asset-card";

describe("NoteMarkdown", () => {
  it("renders the saved title as the document heading", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown title="Project plan" content="Outline the next steps." />,
    );

    expect(html).toContain("<h1");
    expect(html).toContain(">Project plan</h1>");
    expect(html).toContain("Outline the next steps.");
  });

  it("renders compact sizing for small tile previews", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown title="Project plan" content="Outline it." compact />,
    );

    expect(html).toContain("text-[0.6875rem]");
    expect(html).toContain("text-base leading-tight");
    expect(html).not.toContain("text-xl");
    expect(html).not.toContain("leading-6");
  });

  it("keeps the document title above the first heading level", () => {
    const regularHtml = renderToStaticMarkup(
      <NoteMarkdown title="Project plan" content="# First section" />,
    );
    const compactHtml = renderToStaticMarkup(
      <NoteMarkdown title="Project plan" content="# First section" compact />,
    );

    expect(regularHtml).toContain("mb-1.5 text-2xl leading-tight");
    expect(regularHtml).toContain("mb-3 text-xl leading-tight");
    expect(compactHtml).toContain("mb-1 text-base leading-tight");
    expect(compactHtml).toContain("mb-1 text-sm leading-tight");
  });

  it("uses a muted Untitled heading when the title is absent", () => {
    const html = renderToStaticMarkup(<NoteMarkdown content="Draft body." />);

    expect(html).toContain("Untitled</h1>");
    expect(html).toContain("note-card-preview-title--placeholder");
    expect(html).toContain('data-note-title-placeholder="true"');
  });

  it("renders persisted highlights as semantic mark elements", () => {
    expect(
      renderToStaticMarkup(
        <NoteMarkdown content="Keep ==this idea== close." />,
      ),
    ).toContain("<mark");
  });

  it("preserves the highlight color on preview marks", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown
        content={'Keep [highlight color="mint"]this idea[/highlight] close.'}
      />,
    );

    expect(html).toContain('class="note-highlight');
    expect(html).toContain('data-highlight-color="mint"');
    expect(html).not.toContain("bg-amber");
  });

  it("renders task lists without bullets and matches the editor check state", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content={"- [ ] Open\n- [x] Finished"} />,
    );

    expect(html).toContain("contains-task-list");
    expect(html).toContain("note-task-list ml-0 list-none pl-0");
    expect(html).toContain("task-list-item");
    expect(html).toContain("note-task-item ml-0 flex items-start gap-2 pl-0");
    expect(html).toContain("text-sidebar-foreground/50 line-through");
    expect(html).toContain('data-slot="checkbox"');
  });

  it("uses the editor's lowlight classes for code blocks", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content={"```typescript\nconst note = true;\n```"} />,
    );

    expect(html).toContain("hljs-keyword");
  });

  it("shows Mermaid as a compact diagram preview on note cards", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content={"```mermaid\nflowchart LR\nA-->B\n```"} compact />,
    );

    expect(html).toContain("note-mermaid-preview--compact");
    expect(html).not.toContain("note-code-block--preview");
    expect(html).not.toContain("Open diagram full view");
  });

  it("keeps URLs inside code fences unchanged", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown
        content={'```ts\nconst url = "https://example.com"\n```'}
      />,
    );

    expect(html).toContain("https://example.com");
    expect(html).not.toContain("[https://example.com]");
  });

  it("highlights Bash variables with the shared code theme", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content={'```bash\necho "$HOME"\n```'} />,
    );

    expect(html).toContain("hljs-variable");
  });

  it("renders internal references as visual chips rather than protocol links", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content="See [Project plan](note:12)." />,
    );

    expect(html).toContain('data-asset-mention="note"');
    expect(html).not.toContain('href="note:12"');
  });

  it("renders external note links as styled, non-interactive card text", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content="Read [the source](https://example.com)." />,
    );

    expect(html).toContain("the source");
    expect(html).toContain("text-primary");
    expect(html).not.toContain('href="https://example.com"');
  });

  it("renders a note pill with a leading note icon", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content="See [Project plan](note:12)." />,
    );

    expect(html).toContain("<svg");
  });

  it("draws a color pill swatch from payload mention colors", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown
        content="Use [Ocean](color:7)."
        mentionColors={{ "color:7": { hex: "#0a5", gradient: null } }}
      />,
    );

    expect(html).toContain('data-asset-mention="color"');
    expect(html).toContain("background:#0a5");
  });

  it("exposes the payload color as a tint variable", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown
        content="Use [Ocean](color:7)."
        mentionColors={{ "color:7": { hex: "#0a5", gradient: null } }}
      />,
    );

    expect(html).toContain("--mention-tint:#0a5");
  });

  it("renders static preview pills without hover affordances", () => {
    for (const content of ["Use [Ocean](color:7).", "See [Other](note:9)."]) {
      const html = renderToStaticMarkup(
        <NoteMarkdown
          content={content}
          mentionColors={{ "color:7": { hex: "#0a5", gradient: null } }}
        />,
      );

      expect(html).not.toContain("hover:");
    }
  });

  it("resolves a gradient mention into both swatch and tint", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown
        content="Use [Dusk](color:7)."
        mentionColors={{
          "color:7": {
            hex: null,
            gradient: { from: "#ff0000", to: "#0000ff", angle: 90 },
          },
        }}
      />,
    );

    expect(html).toContain("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
    expect(html).toContain("--mention-tint:#ff0000");
  });

  it("omits the swatch for a color pill with no payload data", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content="Use [Ocean](color:7)." />,
    );

    expect(html).toContain('data-asset-mention="color"');
    expect(html).not.toContain("background:");
  });

  it("ignores mention colors belonging to a different asset", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown
        content="Use [Ocean](color:7)."
        mentionColors={{ "color:99": { hex: "#0a5", gradient: null } }}
      />,
    );

    expect(html).toContain('data-asset-mention="color"');
    expect(html).not.toContain("background:#0a5");
  });
});
