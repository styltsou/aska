import type { ContentTypeFilter } from "@/api/collection";

export const FOLDER_TYPES = [
  "folder",
] as const satisfies readonly ContentTypeFilter[];

export const MAX_MOVE_BATCH_SIZE = 100;

export const EMPTY_IDS = new Set<string>();
