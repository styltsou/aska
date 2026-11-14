/** The perspective tilt the auth canvas used to be drawn with. */
export const AUTH_TILTED_PLANE =
  "origin-center transform-[perspective(1200px)_rotateX(4deg)_rotateY(-11deg)_rotateZ(-7deg)_scale(1.02)]";

/**
 * The plane the auth canvas board, folders and open note are drawn on. Flat,
 * so the small UI in the preview (the filter bar, the agent's controls,
 * checklist boxes) stays crisp and reads like the real app. Set it to
 * AUTH_TILTED_PLANE to bring the angled look back.
 */
export const AUTH_BOARD_PLANE = "origin-center";
