import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { ButtonGroup, ButtonGroupSeparator } from "./button-group";

describe("Button interaction styling", () => {
  it("provides press feedback without scaling", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);

    expect(html).toContain("touch-manipulation");
    expect(html).toContain(
      "transition-[background,color,border-color,box-shadow]",
    );
    expect(html).toContain("motion-reduce:transition-none");
    expect(html).not.toContain("active:scale");
  });

  it("renders icon buttons without scaling", () => {
    const html = renderToStaticMarkup(
      <Button size="icon" aria-label="Add item">
        +
      </Button>,
    );

    expect(html).not.toContain("active:scale");
  });

  it("keeps link and grouped buttons visually stable", () => {
    const linkHtml = renderToStaticMarkup(<Button variant="link">Help</Button>);
    const groupHtml = renderToStaticMarkup(
      <ButtonGroup>
        <Button variant="ghost" aria-pressed="true">
          Previous
        </Button>
        <ButtonGroupSeparator />
        <Button variant="ghost">Next</Button>
      </ButtonGroup>,
    );

    expect(linkHtml).not.toContain("active:scale");
    expect(groupHtml).toContain("aria-pressed:bg-muted");
    expect(groupHtml).toContain("bg-border/60");
  });
});
