import { describe, expect, it } from "vitest";

import { createArrowPreviewSessionTracker } from "./canvas-arrow-preview-session";

describe("arrow preview sessions", () => {
  it("prevents an older request from owning a newer active preview", () => {
    const sessions = createArrowPreviewSessionTracker();
    const resize = sessions.begin("arrow-1");
    const rotation = sessions.begin("arrow-1");

    expect(sessions.owns("arrow-1", resize)).toBe(false);
    expect(sessions.owns("arrow-1", rotation)).toBe(true);
  });

  it("tracks different arrows independently", () => {
    const sessions = createArrowPreviewSessionTracker();
    const first = sessions.begin("arrow-1");
    const second = sessions.begin("arrow-2");

    expect(sessions.owns("arrow-1", first)).toBe(true);
    expect(sessions.owns("arrow-2", second)).toBe(true);
  });
});
