import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthPageLayout } from "./auth-page-layout";
import { AUTH_TILTED_PLANE } from "./auth-tilted-plane";

function render() {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <AuthPageLayout>
        <span>Sign in form</span>
      </AuthPageLayout>
    </QueryClientProvider>,
  );
}

describe("AuthPageLayout canvas preview", () => {
  it("draws the board flat, so its small UI stays crisp", () => {
    expect(render()).not.toContain(AUTH_TILTED_PLANE);
  });

  it("renders a board a person could actually keep", () => {
    const html = render();

    for (const text of [
      "Lighting plan",
      "Wall colours",
      "Lighting",
      "Furniture",
      "Clay",
      "Choosing a desk lamp that doesn&#x27;t glare",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Untitled");
  });

  it("keeps the preview out of the tab order", () => {
    expect(render()).toContain("inert");
  });
});
