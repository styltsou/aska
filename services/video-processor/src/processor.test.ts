import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InvalidVideoError, probeVideo } from "./processor";

const run = promisify(execFile);
const canProbe = existsSync("/usr/bin/ffmpeg");
let folder: string;

describe.skipIf(!canProbe)("actual video stream validation", () => {
  beforeAll(async () => {
    folder = await mkdtemp(path.join(tmpdir(), "aska-video-test-"));
  });
  afterAll(async () => {
    if (folder) await rm(folder, { recursive: true, force: true });
  });

  const make = async (fileName: string, codec: string) => {
    const output = path.join(folder, fileName);
    await run(
      "/usr/bin/ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=64x48:d=1",
        "-c:v",
        codec,
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-y",
        output,
      ],
      { timeout: 15_000 },
    );
    return output;
  };

  it("accepts supported MP4 and WebM streams", async () => {
    const mp4 = await make("supported.mp4", "libx264");
    const webm = await make("supported.webm", "libvpx");
    await expect(probeVideo(mp4, "video/mp4")).resolves.toMatchObject({
      width: 64,
      height: 48,
    });
    await expect(probeVideo(webm, "video/webm")).resolves.toMatchObject({
      width: 64,
      height: 48,
    });
  });

  it("rejects a mismatched container and unsupported codec", async () => {
    const mp4 = await make("unsupported.mp4", "mpeg4");
    await expect(probeVideo(mp4, "video/mp4")).rejects.toBeInstanceOf(
      InvalidVideoError,
    );
    await expect(probeVideo(mp4, "video/webm")).rejects.toBeInstanceOf(
      InvalidVideoError,
    );
  });
});
