import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { ButtonGroup, ButtonGroupSeparator } from "./button-group";

describe("Button interaction styling", () => {
  it("uses a restrained press transition on regular buttons", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);

    expect(html).toContain("touch-manipulation");
    expect(html).toContain(
      "transition-[background,color,border-color,box-shadow,transform,scale]",
    );
    expect(html).toContain("active:scale-[0.98]");
    expect(html).toContain("motion-reduce:active:scale-100");
  });

  it("uses a slightly firmer press on standalone icon buttons", () => {
    const html = renderToStaticMarkup(
      <Button size="icon" aria-label="Add item">
        +
      </Button>,
    );

    expect(html).toContain("active:scale-[0.97]");
    expect(html).not.toContain("active:scale-[0.98]");
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

    expect(linkHtml).toContain("active:scale-100");
    expect(linkHtml).not.toContain("active:scale-[0.98]");
    expect(groupHtml).toContain("in-data-[slot=button-group]:active:scale-100");
    expect(groupHtml).toContain("aria-pressed:bg-muted");
    expect(groupHtml).toContain("bg-border/60");
  });
});
