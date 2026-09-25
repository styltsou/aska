import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NoteMarkdown } from "./note-asset-card";

describe("NoteMarkdown", () => {
  it("renders the saved title as the document heading", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown title="Project plan" content="Outline the next steps." />,
    );

    expect(html).toContain("<h1");
    expect(html).toContain(">Project plan</h1><p");
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

    expect(regularHtml).toContain("mb-2 text-2xl leading-tight");
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

  it("renders task-list checkboxes", () => {
    const html = renderToStaticMarkup(
      <NoteMarkdown content={"- [ ] Open\n- [x] Finished"} />,
    );

    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
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
});
