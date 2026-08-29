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
