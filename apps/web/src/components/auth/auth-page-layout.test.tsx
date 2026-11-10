import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthPageLayout } from "./auth-page-layout";

describe("AuthPageLayout canvas preview", () => {
  it("uses the same tilted plane for the dots and preview cards", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AuthPageLayout>
          <span>Sign in form</span>
        </AuthPageLayout>
      </QueryClientProvider>,
    );

    expect(html.match(/auth-canvas-tilted-plane/g)).toHaveLength(2);
  });

  it("renders preview note headings as titles without Untitled fallbacks", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AuthPageLayout>
          <span>Sign in form</span>
        </AuthPageLayout>
      </QueryClientProvider>,
    );

    for (const title of [
      "Material cues",
      "Colour as structure",
      "Rhythm",
      "Reference set",
      "Surface samples",
      "Pause",
    ]) {
      expect(html).toContain(title);
    }
    expect(html).not.toContain("Untitled");
  });
});
