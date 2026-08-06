import { env } from "@/config";
import type { UnsplashSearchQuery } from "@/dto/upload.dto";
import { AppError, ErrorCode } from "@/lib/errors";

const UNSPLASH_API_ORIGIN = "https://api.unsplash.com";

type UnsplashApiPhoto = {
  id: string;
  width: number;
  height: number;
  alt_description: string | null;
  description: string | null;
  urls: { thumb: string; small: string; regular: string };
  links: { html: string };
  user: { name: string; username: string; links: { html: string } };
  links_download_location: string;
};

type UnsplashSearchResponse = {
  total_pages: number;
  results: UnsplashApiPhoto[];
};

export type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  alt: string | null;
  urls: { thumb: string; small: string; regular: string };
  url: string;
  downloadLocation: string;
  photographer: { name: string; username: string; profileUrl: string };
};

export type UnsplashSearchResult = {
  page: number;
  perPage: number;
  totalPages: number;
  results: UnsplashPhoto[];
};

export interface IUnsplashService {
  search(query: UnsplashSearchQuery): Promise<UnsplashSearchResult>;
  resolveDownloadUrl(downloadLocation: string): Promise<string>;
}

export class UnsplashService implements IUnsplashService {
  async search(query: UnsplashSearchQuery): Promise<UnsplashSearchResult> {
    const url = new URL("/search/photos", UNSPLASH_API_ORIGIN);
    url.searchParams.set("query", query.query);
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("per_page", String(query.perPage));
    url.searchParams.set("client_id", this.accessKey());

    const payload = await this.fetchJson<UnsplashSearchResponse>(url);
    return {
      page: query.page,
      perPage: query.perPage,
      totalPages: payload.total_pages,
      results: payload.results.map((photo) => ({
        id: photo.id,
        width: photo.width,
        height: photo.height,
        alt: photo.alt_description ?? photo.description,
        urls: photo.urls,
        url: photo.links.html,
        downloadLocation: photo.links_download_location,
        photographer: {
          name: photo.user.name,
          username: photo.user.username,
          profileUrl: photo.user.links.html,
        },
      })),
    };
  }

  async resolveDownloadUrl(downloadLocation: string): Promise<string> {
    const url = new URL(downloadLocation);
    if (url.origin !== UNSPLASH_API_ORIGIN) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Unsplash download location must be an Unsplash API URL",
      );
    }
    url.searchParams.set("client_id", this.accessKey());
    const payload = await this.fetchJson<{ url?: string }>(url);
    if (!payload.url) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Unsplash did not return a download URL",
      );
    }
    return payload.url;
  }

  private accessKey(): string {
    if (!env.UNSPLASH_ACCESS_KEY) {
      throw new AppError(
        ErrorCode.NOT_IMPLEMENTED,
        "Unsplash is not configured",
      );
    }
    return env.UNSPLASH_ACCESS_KEY;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Unsplash request failed with status ${response.status}`,
      );
    }
    return response.json() as Promise<T>;
  }
}
