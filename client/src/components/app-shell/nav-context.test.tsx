import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NavContext } from "./nav-context";

describe("folder sidebar section", () => {
  it("keeps the section visible with stable rows while a level loads", () => {
    const markup = renderToStaticMarkup(
      <NavContext items={[]} isLoading={true} />,
    );

    expect(markup).toContain(">Folders<");
    expect(markup.match(/data-slot="skeleton"/g)).toHaveLength(6);
  });
});
