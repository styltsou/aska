import { describe, expect, it } from "vitest";

import {
  colorDrilldownReducer,
  type ColorDrilldownState,
} from "./use-color-drilldown";

const COLOR = {
  id: "color-1",
  type: "color" as const,
  hex: "#1a2b3c",
  title: "Midnight blue",
  isFavorite: false,
};

const EMPTY_STATE: ColorDrilldownState = {
  color: undefined,
  imageDrilldownActive: false,
};

describe("color drill-down navigation", () => {
  it("returns from a matching image to its retained color", () => {
    const colorOpen = colorDrilldownReducer(EMPTY_STATE, {
      type: "open-color",
      color: COLOR,
    });
    const imageOpen = colorDrilldownReducer(colorOpen, {
      type: "open-image",
    });
    const returned = colorDrilldownReducer(imageOpen, {
      type: "return-to-color",
    });

    expect(imageOpen).toEqual({ color: COLOR, imageDrilldownActive: true });
    expect(returned).toEqual({
      color: COLOR,
      imageDrilldownActive: false,
    });
  });

  it("closes the color layer after returning to its origin", () => {
    const open = colorDrilldownReducer(EMPTY_STATE, {
      type: "open-color",
      color: COLOR,
    });

    expect(colorDrilldownReducer(open, { type: "close-color" })).toEqual(
      EMPTY_STATE,
    );
  });

  it("does not create a drill-down when no color is active", () => {
    expect(colorDrilldownReducer(EMPTY_STATE, { type: "open-image" })).toBe(
      EMPTY_STATE,
    );
  });
});
