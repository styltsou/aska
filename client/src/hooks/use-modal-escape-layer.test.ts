import { describe, expect, it } from "vitest";

import { isTopmostModalEscapeLayer } from "./use-modal-escape-layer";

describe("modal Escape ordering", () => {
  it("only grants Escape to the most recently activated layer", () => {
    const activeOrders = [3, 5, 8];

    expect(isTopmostModalEscapeLayer(8, activeOrders)).toBe(true);
    expect(isTopmostModalEscapeLayer(5, activeOrders)).toBe(false);
    expect(isTopmostModalEscapeLayer(3, activeOrders)).toBe(false);
  });

  it("falls through once the top layer has been removed", () => {
    const activeOrders = [3, 5];

    expect(isTopmostModalEscapeLayer(5, activeOrders)).toBe(true);
    expect(isTopmostModalEscapeLayer(undefined, activeOrders)).toBe(false);
    expect(isTopmostModalEscapeLayer(8, activeOrders)).toBe(false);
  });
});
