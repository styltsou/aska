import { describe, expect, it, vi } from "vitest";

import type { IObjectStorageService } from "@/services/object-storage.service";

import { ColorSearchRepository } from "./color-search/color-search.repository";
import { ColorSearchService } from "./color-search.service";

describe("ColorSearchService", () => {
  it("keeps candidate retrieval tenant-scoped and signs only selected previews", async () => {
    const repository = {
      resolveScope: vi.fn().mockResolvedValue({ type: "inbox" }),
      getScopedImageCount: vi.fn().mockResolvedValue(2),
      findBroadCandidateAssets: vi.fn().mockResolvedValue({
        assetIds: [17, 99],
        reachedSafetyCap: false,
      }),
      getPaletteColors: vi.fn().mockResolvedValue([
        {
          id: 1,
          assetId: 17,
          hex: "#d94732",
          oklabL: 0.628,
          oklabA: 0.225,
          oklabB: 0.126,
          coverage: 0.7,
          salience: 0.8,
          isAccent: false,
        },
      ]),
      getImageMetadata: vi.fn().mockResolvedValue([
        {
          assetId: 17,
          title: "Reference",
          width: 1200,
          height: 800,
          alt: null,
          blurDataURL: null,
          dominantColors: ["#d94732"],
          variants: {
            preview: {
              objectKey: "assets/17/preview.webp",
              width: 400,
              height: 267,
              contentType: "image/webp",
              sizeBytes: 1_000,
            },
          },
        },
      ]),
      getImageLocations: vi.fn().mockResolvedValue([
        {
          assetId: 17,
          location: { type: "inbox", nodeId: "image-17", position: null },
        },
      ]),
    } as unknown as ColorSearchRepository;
    const createPresignedGetUrls = vi.fn().mockResolvedValue(
      new Map([
        [
          "assets/17/preview.webp",
          {
            key: "assets/17/preview.webp",
            url: "https://signed.example/17",
            expiresAt: new Date(),
          },
        ],
      ]),
    );
    const service = new ColorSearchService(
      {
        objectStorageService: {
          createPresignedGetUrls,
        } as unknown as IObjectStorageService,
        loggerService: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      },
      repository,
    );

    const response = await service.search("workspace-1", {
      colors: [{ oklabL: 0.628, oklabA: 0.225, oklabB: 0.126 }],
      scope: { type: "inbox" },
    });

    expect(repository.findBroadCandidateAssets).toHaveBeenCalledWith(
      "workspace-1",
      { type: "inbox" },
      [{ oklabL: 0.628, oklabA: 0.225, oklabB: 0.126 }],
    );
    expect(repository.getImageMetadata).toHaveBeenCalledWith(
      "workspace-1",
      [17],
    );
    expect(repository.getImageLocations).toHaveBeenCalledWith(
      "workspace-1",
      { type: "inbox" },
      [17],
    );
    expect(createPresignedGetUrls).toHaveBeenCalledWith([
      "assets/17/preview.webp",
    ]);
    expect(response.results).toMatchObject([
      {
        image: { id: "image-17", url: "https://signed.example/17" },
        location: { type: "inbox" },
      },
    ]);
  });
});
