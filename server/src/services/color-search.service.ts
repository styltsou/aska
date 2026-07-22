import type {
  ColorSearchInput,
  ColorSearchResponse,
} from "@/dto/color-search.dto";
import type { ILoggerService } from "@/services/logger.service";
import type { IObjectStorageService } from "@/services/object-storage.service";

import {
  COLOR_SEARCH_ALGORITHM_VERSION,
  COLOR_SEARCH_CONFIG,
  applyAdaptiveCutoff,
  normalizeQueryColors,
  rankPalette,
} from "./color-search/color-search-ranker";
import { ColorSearchRepository } from "./color-search/color-search.repository";

type Deps = {
  objectStorageService: IObjectStorageService;
  loggerService: ILoggerService;
};

export interface IColorSearchService {
  search(orgId: string, input: ColorSearchInput): Promise<ColorSearchResponse>;
}

export class ColorSearchService implements IColorSearchService {
  private readonly objectStorageService: IObjectStorageService;
  private readonly loggerService: ILoggerService;
  private readonly repository: ColorSearchRepository;

  constructor(deps: Deps, repository = new ColorSearchRepository()) {
    this.objectStorageService = deps.objectStorageService;
    this.loggerService = deps.loggerService;
    this.repository = repository;
  }

  async search(
    orgId: string,
    input: ColorSearchInput,
  ): Promise<ColorSearchResponse> {
    const startedAt = performance.now();
    const queryColors = normalizeQueryColors(input.colors);
    const scope = await this.repository.resolveScope(orgId, input.scope);
    const [scopedImageCount, broadCandidates] = await Promise.all([
      this.repository.getScopedImageCount(orgId, scope),
      this.repository.findBroadCandidateAssets(orgId, scope, queryColors),
    ]);
    const paletteRows = await this.repository.getPaletteColors(
      broadCandidates.assetIds,
    );
    const palettesByAssetId = groupPaletteRows(paletteRows);
    const rankedCandidates = broadCandidates.assetIds.flatMap((assetId) => {
      const palette = palettesByAssetId.get(assetId);
      if (!palette) return [];

      const ranked = rankPalette(assetId, queryColors, palette);
      return ranked ? [ranked] : [];
    });
    const thresholded = applyAdaptiveCutoff(rankedCandidates);
    const selected = thresholded.results.slice(
      0,
      COLOR_SEARCH_CONFIG.maxResults,
    );
    const selectedAssetIds = selected.map((result) => result.assetId);
    const [metadata, scopedImages] = await Promise.all([
      this.repository.getImageMetadata(orgId, selectedAssetIds),
      this.repository.getImageLocations(orgId, scope, selectedAssetIds),
    ]);
    const metadataByAssetId = new Map(
      metadata.map((image) => [image.assetId, image]),
    );
    const scopeByAssetId = new Map(
      scopedImages.map((image) => [image.assetId, image]),
    );
    const resultVariants = selected.flatMap((result) => {
      const image = metadataByAssetId.get(result.assetId);
      const variant = image?.variants.preview ?? image?.variants.display;
      return variant ? [variant] : [];
    });
    const signedUrls = await this.objectStorageService.createPresignedGetUrls(
      resultVariants.map((variant) => variant.objectKey),
    );

    const results = selected.flatMap((result) => {
      const image = metadataByAssetId.get(result.assetId);
      const scopedImage = scopeByAssetId.get(result.assetId);
      const variant = image?.variants.preview ?? image?.variants.display;
      const signed = variant ? signedUrls.get(variant.objectKey) : undefined;
      if (!image || !scopedImage || !variant || !signed) return [];

      return [
        {
          image: {
            id: `image-${result.assetId}`,
            url: signed.url,
            width: variant.width,
            height: variant.height,
            title: image.title,
            alt: image.alt,
            blurDataURL: image.blurDataURL,
            dominantColors: image.dominantColors,
          },
          relevance: result.relevance,
          matches: result.matches,
          location: scopedImage.location,
        },
      ];
    });
    const truncated =
      broadCandidates.reachedSafetyCap ||
      thresholded.results.length > COLOR_SEARCH_CONFIG.maxResults ||
      results.length < selected.length;

    this.logSearch({
      input,
      scopedImageCount,
      candidateCount: broadCandidates.assetIds.length,
      returned: results.length,
      cutoff: thresholded.cutoff,
      truncated,
      durationMs: performance.now() - startedAt,
    });

    return {
      query: {
        colors: queryColors,
        scope: input.scope,
      },
      results,
      meta: {
        returned: results.length,
        cutoff: thresholded.cutoff,
        truncated,
      },
      algorithmVersion: COLOR_SEARCH_ALGORITHM_VERSION,
    };
  }

  private logSearch(input: {
    input: ColorSearchInput;
    scopedImageCount: number;
    candidateCount: number;
    returned: number;
    cutoff: number;
    truncated: boolean;
    durationMs: number;
  }): void {
    this.loggerService.info("Color image search completed", {
      algorithmVersion: COLOR_SEARCH_ALGORITHM_VERSION,
      colorCount: input.input.colors.length,
      normalizedColorCount: normalizeQueryColors(input.input.colors).length,
      scopeType: input.input.scope.type,
      scopedImageCount: input.scopedImageCount,
      candidateCount: input.candidateCount,
      returned: input.returned,
      cutoff: input.cutoff,
      truncated: input.truncated,
      durationMs: Math.round(input.durationMs),
    });
  }
}

function groupPaletteRows(
  rows: Awaited<ReturnType<ColorSearchRepository["getPaletteColors"]>>,
): Map<number, typeof rows> {
  const grouped = new Map<number, typeof rows>();
  for (const row of rows) {
    const palette = grouped.get(row.assetId);
    if (palette) {
      palette.push(row);
    } else {
      grouped.set(row.assetId, [row]);
    }
  }
  return grouped;
}
