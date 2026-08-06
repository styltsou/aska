import { env } from "@/config";
import type { PexelsSearchQuery } from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";

const PEXELS_API_ORIGIN = "https://api.pexels.com";
const PEXELS_IMAGE_ORIGIN = "https://images.pexels.com";

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  alt: string;
  url: string;
  photographer: string;
  photographer_url: string;
  src: { tiny: string; medium: string; large: string; original: string };
};

type PexelsSearchResponse = {
  page: number;
  per_page: number;
  total_results: number;
  photos: PexelsPhoto[];
};

export type PexelsSearchResult = {
  page: number;
  perPage: number;
  totalResults: number;
  results: Array<{
    id: string;
    width: number;
    height: number;
    alt: string | null;
    urls: { thumb: string; small: string; regular: string; original: string };
    url: string;
    photographer: { name: string; profileUrl: string };
  }>;
};

export interface IPexelsService {
  search(query: PexelsSearchQuery): Promise<PexelsSearchResult>;
  validateDownloadUrl(downloadUrl: string): string;
}

export class PexelsService implements IPexelsService {
  async search(query: PexelsSearchQuery): Promise<PexelsSearchResult> {
    const url = new URL("/v1/search", PEXELS_API_ORIGIN);
    url.searchParams.set("query", query.query);
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("per_page", String(query.perPage));
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", Authorization: this.apiKey() },
    });
    if (!response.ok) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Pexels request failed with status ${response.status}`,
      );
    }
    const payload = (await response.json()) as PexelsSearchResponse;
    return {
      page: payload.page,
      perPage: payload.per_page,
      totalResults: payload.total_results,
      results: payload.photos.map((photo) => ({
        id: String(photo.id),
        width: photo.width,
        height: photo.height,
        alt: photo.alt || null,
        urls: {
          thumb: photo.src.tiny,
          small: photo.src.medium,
          regular: photo.src.large,
          original: photo.src.original,
        },
        url: photo.url,
        photographer: {
          name: photo.photographer,
          profileUrl: photo.photographer_url,
        },
      })),
    };
  }

  validateDownloadUrl(downloadUrl: string): string {
    const url = new URL(downloadUrl);
    if (url.origin !== PEXELS_IMAGE_ORIGIN) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Pexels image URL must use the Pexels image CDN",
      );
    }
    return url.toString();
  }

  private apiKey(): string {
    if (!env.PEXELS_API_KEY) {
      throw new AppError(ErrorCode.NOT_IMPLEMENTED, "Pexels is not configured");
    }
    return env.PEXELS_API_KEY;
  }
}
