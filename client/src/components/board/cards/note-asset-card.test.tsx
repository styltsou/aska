import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NoteMarkdown } from "./note-asset-card";

describe("NoteMarkdown", () => {
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
});
