import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeVideoPlaybackPosition,
  recordVideoPlaybackPosition,
} from "./video-playback-position";

describe("video playback position handoff", () => {
  afterEach(() => vi.useRealTimers());

  it("hands a recent preview position to the viewer once", () => {
    recordVideoPlaybackPosition("video-1", 12.75);

    expect(consumeVideoPlaybackPosition("video-1")).toBe(12.75);
    expect(consumeVideoPlaybackPosition("video-1")).toBeUndefined();
  });

  it("expires an activation handoff that no viewer consumes", () => {
    vi.useFakeTimers();
    recordVideoPlaybackPosition("video-2", 4);
    vi.advanceTimersByTime(1_000);

    expect(consumeVideoPlaybackPosition("video-2")).toBeUndefined();
  });
});
