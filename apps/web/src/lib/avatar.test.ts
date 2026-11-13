import { describe, expect, it } from "vitest";
import { gradientAvatarValue, resolveAvatar } from "./avatar";

const google = "https://lh3.googleusercontent.com/a/photo";

describe("resolveAvatar", () => {
  it("uses the Google picture when nothing was chosen", () => {
    const avatar = resolveAvatar({ id: "u1", image: google, avatar: null });
    expect(avatar).toMatchObject({ kind: "image", src: google });
  });

  it("keeps a chosen gradient over the Google picture", () => {
    const avatar = resolveAvatar({
      id: "u1",
      image: google,
      avatar: gradientAvatarValue("ember"),
    });
    expect(avatar).toMatchObject({
      kind: "gradient",
      explicit: true,
      gradient: { id: "ember" },
    });
  });

  it("falls back to a stable gradient for users with no picture", () => {
    const first = resolveAvatar({ id: "u1" });
    const second = resolveAvatar({ id: "u1" });
    expect(first).toMatchObject({ kind: "gradient", explicit: false });
    expect(first).toEqual(second);
  });

  it("ignores a gradient id that no longer exists", () => {
    const avatar = resolveAvatar({
      id: "u1",
      image: google,
      avatar: "gradient:removed",
    });
    expect(avatar).toMatchObject({ kind: "image", src: google });
  });
});
