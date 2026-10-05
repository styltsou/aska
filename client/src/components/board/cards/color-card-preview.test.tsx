import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ColorCardPreview } from "./color-card-preview";

describe("ColorCardPreview", () => {
  it("renders the color-card surface and metadata instead of a bare swatch", () => {
    const html = renderToStaticMarkup(
      <ColorCardPreview hex="#1a2b3c" title="Midnight blue" />,
    );

    expect(html).toContain("data-color-card-preview");
    expect(html).toContain("data-color-card-preview-swatch");
    expect(html).toContain("w-full flex-1 overflow-hidden rounded-b-lg");
    expect(html).toContain("rounded-b-lg border-b border-border");
    expect(html).toContain("bg-sidebar px-[4.3%] py-[4.3%]");
    expect(html).toContain("Midnight blue");
    expect(html).toContain("#1A2B3C");
  });

  it("keeps the complete gradient on the card surface", () => {
    const html = renderToStaticMarkup(
      <ColorCardPreview
        hex="#f43f5e"
        gradient={{
          from: "#f43f5e",
          to: "#7c3aed",
          angle: 135,
          type: "radial",
        }}
      />,
    );

    expect(html).toContain("radial-gradient(circle, #f43f5e 0%, #7c3aed 100%)");
    expect(html).toContain("Radial gradient");
  });
});
