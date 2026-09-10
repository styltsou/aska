import { useCallback, useReducer } from "react";

import type { ColorAsset } from "@/types/asset";

export type ColorDrilldownState = {
  color: ColorAsset | undefined;
  imageDrilldownActive: boolean;
};

type ColorDrilldownAction =
  | { type: "open-color"; color: ColorAsset }
  | { type: "close-color" }
  | { type: "open-image" }
  | { type: "return-to-color" };

export function colorDrilldownReducer(
  state: ColorDrilldownState,
  action: ColorDrilldownAction,
): ColorDrilldownState {
  switch (action.type) {
    case "open-color":
      return { color: action.color, imageDrilldownActive: false };
    case "close-color":
      return { color: undefined, imageDrilldownActive: false };
    case "open-image":
      return state.color ? { ...state, imageDrilldownActive: true } : state;
    case "return-to-color":
      return state.color ? { ...state, imageDrilldownActive: false } : state;
  }
}

const INITIAL_STATE: ColorDrilldownState = {
  color: undefined,
  imageDrilldownActive: false,
};

/** Keeps a color drawer alive while its matching image is being inspected. */
export function useColorDrilldown() {
  const [state, dispatch] = useReducer(colorDrilldownReducer, INITIAL_STATE);

  const openColor = useCallback((color: ColorAsset) => {
    dispatch({ type: "open-color", color });
  }, []);
  const closeColor = useCallback(() => {
    dispatch({ type: "close-color" });
  }, []);
  const openImageFromColor = useCallback(() => {
    dispatch({ type: "open-image" });
  }, []);
  const returnToColor = useCallback(() => {
    dispatch({ type: "return-to-color" });
  }, []);

  return {
    color: state.color,
    isImageDrilldown: state.imageDrilldownActive && state.color !== undefined,
    openColor,
    closeColor,
    openImageFromColor,
    returnToColor,
  };
}
