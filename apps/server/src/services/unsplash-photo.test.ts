import { describe, expect, it } from "vitest";

import { isUnsplashPhotoUrl, parseUnsplashPhoto } from "./unsplash-photo";

const pageUrl = "https://unsplash.com/photos/a-photo-JmuyB_LibRo";
const imagePath = "photo-1624138784614-87fd1b6528f8";

describe("Unsplash photo pages", () => {
  it.each([
    "https://unsplash.com/photos/JmuyB_LibRo",
    pageUrl,
    `${pageUrl}?utm_source=share`,
  ])("accepts a photo page: %s", (url) => {
    expect(isUnsplashPhotoUrl(url)).toBe(true);
  });

  it.each([
    "https://unsplash.com/s/photos/nature",
    "https://unsplash.com/@photographer",
    "https://unsplash.com.evil.test/photos/JmuyB_LibRo",
    "http://unsplash.com/photos/JmuyB_LibRo",
  ])("leaves other URLs as links: %s", (url) => {
    expect(isUnsplashPhotoUrl(url)).toBe(false);
  });

  it("selects the unbranded main photo and retains the source page", () => {
    const photo = parseUnsplashPhoto(
      `<head>
        <link as="image" rel="preload" imageSrcSet="https://images.unsplash.com/${imagePath}?w=1033&amp;ixid=abc 1033w, https://images.unsplash.com/${imagePath}?w=1633&amp;ixid=abc 1633w, https://images.unsplash.com/${imagePath}?w=2233&amp;ixid=abc 2233w">
        <title>Sydney opera house - Free Photo on Unsplash</title>
        <meta property="og:image" content="https://images.unsplash.com/${imagePath}?mark=logo&amp;w=1200&amp;ixid=abc">
      </head>`,
      pageUrl,
    );

    expect(photo).toEqual({
      url: `https://images.unsplash.com/${imagePath}?w=1633&ixid=abc`,
      sourceUrl: pageUrl,
      title: "Sydney opera house",
      alt: "Sydney opera house",
    });
  });

  it("uses a clean CDN URL when only a social preview is available", () => {
    const photo = parseUnsplashPhoto(
      `<head><meta property="og:image" content="https://images.unsplash.com/${imagePath}?mark=logo&amp;w=1200&amp;ixid=abc"></head>`,
      pageUrl,
    );

    expect(photo?.url).toBe(
      `https://images.unsplash.com/${imagePath}?ixid=abc&w=1600&q=80&auto=format`,
    );
  });

  it("refuses a social image hosted outside Unsplash", () => {
    expect(
      parseUnsplashPhoto(
        '<head><meta property="og:image" content="https://example.com/image.jpg"></head>',
        pageUrl,
      ),
    ).toBeNull();
  });
});
