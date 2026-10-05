import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ColorAssetCard } from "./color-asset-card";

describe("ColorAssetCard", () => {
  it("stacks a square swatch above the card surface", () => {
    const html = renderToStaticMarkup(
      <ColorAssetCard
        asset={{
          id: "color-1",
          type: "color",
          hex: "#1a2b3c",
          title: "Midnight blue",
          isFavorite: false,
        }}
      />,
    );

    expect(html).toContain("aspect-square w-full");
    expect(html).toContain("aspect-square w-full overflow-hidden rounded-b-lg");
    expect(html).toContain("rounded-b-lg border-b border-border");
    expect(html).not.toContain('class="p-3"');
    expect(html).toContain("data-asset-card-outline");
    expect(html).toContain("hover:border-sidebar-foreground/20");
    expect(html).toContain("transition-colors duration-100");
    expect(html).not.toContain("transition-all");
    expect(html).toContain(
      "flex min-w-0 items-center gap-3 bg-sidebar p-3 leading-6",
    );
    expect(html).not.toContain("border-t border-sidebar-foreground/10");
  });

  it("promotes the hex value when the color has no name", () => {
    const html = renderToStaticMarkup(
      <ColorAssetCard
        asset={{
          id: "color-1",
          type: "color",
          hex: "#1a2b3c",
          title: null,
          isFavorite: false,
        }}
      />,
    );

    expect(html.match(/#1A2B3C/g)).toHaveLength(1);
    expect(html).toContain("font-mono text-lg font-semibold");
  });

  it("uses a gradient label instead of its first stop", () => {
    const html = renderToStaticMarkup(
      <ColorAssetCard
        asset={{
          id: "color-1",
          type: "color",
          hex: "#f43f5e",
          title: null,
          isFavorite: false,
          gradient: {
            from: "#f43f5e",
            to: "#7c3aed",
            angle: 135,
            type: "radial",
          },
        }}
      />,
    );

    expect(html).toContain("Radial gradient");
    expect(html).not.toContain("#F43F5E");
  });
});
