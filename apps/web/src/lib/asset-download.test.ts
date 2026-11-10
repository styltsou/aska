import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAssetOriginal } from "./asset-download";
import { apiGet } from "@/lib/api";
import { fetchAssetImageBlob } from "@/api/collection/fetchers";

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  getUserFacingApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/api/collection/fetchers", () => ({ fetchAssetImageBlob: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("original downloads", () => {
  it("saves the authenticated image response", async () => {
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", {
      createElement: () => link,
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("window", { setTimeout: vi.fn() });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:original");
    vi.mocked(fetchAssetImageBlob).mockResolvedValue(
      new Blob(["image"], { type: "image/png" }),
    );
    await downloadAssetOriginal("workspace", {
      type: "image",
      id: "image-1",
      url: "",
      width: 1,
      height: 1,
      title: "picture",
    });
    expect(fetchAssetImageBlob).toHaveBeenCalledWith("workspace", "image-1");
    expect(link.href).toBe("blob:original");
    expect(link.download).toBe("picture.png");
    expect(link.click).toHaveBeenCalled();
  });
  it("requests and opens a signed video download link", async () => {
    const link = { href: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", {
      createElement: () => link,
      body: { appendChild: vi.fn() },
    });
    vi.mocked(apiGet).mockResolvedValue({
      url: "https://storage.example/video",
    });
    await downloadAssetOriginal("my workspace", {
      type: "video",
      id: "video-1",
      url: "",
      contentType: "video/mp4",
      processingStatus: "completed",
    });
    expect(apiGet).toHaveBeenCalledWith(
      "/api/v1/workspace/my%20workspace/assets/video-1/download?format=json",
    );
    expect(link.href).toBe("https://storage.example/video");
    expect(link.click).toHaveBeenCalled();
  });
});
