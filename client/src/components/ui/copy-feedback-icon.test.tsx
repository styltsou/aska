import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CopyFeedbackIcon } from "./copy-feedback-icon";

describe("CopyFeedbackIcon", () => {
  it("renders the copy and copied states with forwarded styling", () => {
    const copy = renderToStaticMarkup(
      <CopyFeedbackIcon copied={false} className="size-4" />,
    );
    const copied = renderToStaticMarkup(
      <CopyFeedbackIcon copied className="size-4" />,
    );

    expect(copy).toContain('class="size-4"');
    expect(copy).toContain("M10 8");
    expect(copied).toContain('class="size-4"');
    expect(copied).toContain("M20 6");
  });
});
