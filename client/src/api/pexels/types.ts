export type PexelsPhoto = {
  id: string;
  width: number;
  height: number;
  alt: string | null;
  urls: { thumb: string; small: string; regular: string; original: string };
  url: string;
  photographer: { name: string; profileUrl: string };
};

export type PexelsSearchResponse = {
  page: number;
  perPage: number;
  totalResults: number;
  results: PexelsPhoto[];
};
