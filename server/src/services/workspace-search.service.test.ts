import { describe, expect, it, vi } from "vitest";

import type { IObjectStorageService } from "@/services/object-storage.service";

const selectMock = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({ db: { select: selectMock } }));

import { WorkspaceSearchService } from "./workspace-search.service";

function queryReturning<T>(rows: T[]) {
  const query = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };

  for (const method of [
    query.from,
    query.leftJoin,
    query.innerJoin,
    query.where,
    query.orderBy,
  ]) {
    method.mockReturnValue(query);
  }

  return query;
}

function queryWhereReturning<T>(rows: T[]) {
  const query = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue(rows),
  };
  query.from.mockReturnValue(query);
  return query;
}

const imageRow = {
  assetId: 17,
  assetType: "image" as const,
  title: "Reference",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  noteContent: null,
  imageAlt: "Reference image",
  imageNote: null,
  imageBlurDataURL: "data:image/webp;base64,blur",
  imageVariants: {
    preview: {
      objectKey: "workspace-1/17/preview.webp",
      width: 320,
      height: 200,
      contentType: "image/webp",
      sizeBytes: 1000,
    },
  },
  colorHex: null,
  linkOriginalUrl: null,
  linkNote: null,
  linkHostname: null,
  linkTitle: null,
  linkDescription: null,
  linkSiteName: null,
  linkResourceKind: null,
  linkResolverKey: null,
  collectionName: null,
  collectionSlug: null,
  pathFolderNames: null,
  pathFolderSlugs: null,
  rank: 0,
};

describe("WorkspaceSearchService", () => {
  it("returns a signed preview URL and keeps blur data as a placeholder", async () => {
    selectMock.mockImplementationOnce(() => queryReturning([imageRow]));
    selectMock.mockImplementationOnce(() => queryReturning([]));
    selectMock.mockImplementationOnce(() => queryReturning([]));

    const createPresignedGetUrls = vi.fn().mockResolvedValue(
      new Map([
        [
          "workspace-1/17/preview.webp",
          {
            key: "workspace-1/17/preview.webp",
            url: "https://signed.example/17-preview",
            expiresAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      ]),
    );
    const service = new WorkspaceSearchService({
      objectStorageService: {
        createPresignedGetUrls,
      } as unknown as IObjectStorageService,
    });

    const response = await service.search("workspace-1", {
      q: "reference",
      limit: 20,
      recent: [],
    });

    expect(createPresignedGetUrls).toHaveBeenCalledWith([
      "workspace-1/17/preview.webp",
    ]);
    expect(response.results).toMatchObject([
      {
        id: "image-17",
        preview: {
          url: "https://signed.example/17-preview",
          blurDataURL: "data:image/webp;base64,blur",
        },
      },
    ]);
  });

  it("falls back to the display variant when preview is unavailable", async () => {
    selectMock.mockImplementationOnce(() =>
      queryReturning([
        {
          ...imageRow,
          imageVariants: {
            display: {
              objectKey: "workspace-1/17/display.webp",
              width: 960,
              height: 600,
              contentType: "image/webp",
              sizeBytes: 2000,
            },
          },
        },
      ]),
    );
    selectMock.mockImplementationOnce(() => queryReturning([]));
    selectMock.mockImplementationOnce(() => queryReturning([]));

    const createPresignedGetUrls = vi.fn().mockResolvedValue(
      new Map([
        [
          "workspace-1/17/display.webp",
          {
            key: "workspace-1/17/display.webp",
            url: "https://signed.example/17-display",
            expiresAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      ]),
    );
    const service = new WorkspaceSearchService({
      objectStorageService: {
        createPresignedGetUrls,
      } as unknown as IObjectStorageService,
    });

    const response = await service.search("workspace-1", {
      q: "reference",
      limit: 20,
      recent: [],
    });

    expect(createPresignedGetUrls).toHaveBeenCalledWith([
      "workspace-1/17/display.webp",
    ]);
    expect(response.results[0]?.preview).toMatchObject({
      url: "https://signed.example/17-display",
    });
  });

  it("returns a signed favicon for link results", async () => {
    selectMock.mockImplementationOnce(() =>
      queryReturning([
        {
          ...imageRow,
          assetId: 31,
          assetType: "link" as const,
          title: null,
          imageAlt: null,
          imageNote: null,
          imageBlurDataURL: null,
          imageVariants: null,
          linkOriginalUrl: "https://example.com/article",
          linkResourceId: 7,
          linkHostname: "example.com",
          linkTitle: "Example article",
          linkDescription: null,
          linkSiteName: null,
          linkResourceKind: "web_page",
          linkResolverKey: "generic-html",
        },
      ]),
    );
    selectMock.mockImplementationOnce(() => queryReturning([]));
    selectMock.mockImplementationOnce(() => queryReturning([]));
    selectMock.mockImplementationOnce(() =>
      queryWhereReturning([
        {
          resourceId: 7,
          variants: {
            preview: {
              objectKey: "workspace-1/7/icon-preview.webp",
              width: 64,
              height: 64,
              contentType: "image/webp",
              sizeBytes: 500,
            },
          },
        },
      ]),
    );

    const createPresignedGetUrls = vi.fn().mockResolvedValue(
      new Map([
        [
          "workspace-1/7/icon-preview.webp",
          {
            key: "workspace-1/7/icon-preview.webp",
            url: "https://signed.example/7-favicon",
            expiresAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      ]),
    );
    const service = new WorkspaceSearchService({
      objectStorageService: {
        createPresignedGetUrls,
      } as unknown as IObjectStorageService,
    });

    const response = await service.search("workspace-1", {
      q: "example",
      limit: 20,
      recent: [],
    });

    expect(createPresignedGetUrls).toHaveBeenCalledWith([
      "workspace-1/7/icon-preview.webp",
    ]);
    expect(response.results[0]?.preview).toMatchObject({
      faviconUrl: "https://signed.example/7-favicon",
      hostname: "example.com",
    });
  });
});
