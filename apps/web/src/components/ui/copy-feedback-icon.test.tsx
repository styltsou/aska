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

    expect(copy).toContain("size-4");
    expect(copy.indexOf("opacity-100")).toBeLessThan(copy.indexOf("opacity-0"));
    expect(copied).toContain("size-4");
    expect(copied.indexOf("opacity-0")).toBeLessThan(
      copied.indexOf("opacity-100"),
    );
  });
});
