import { db } from "@/db";
import { AssetService } from "@/services/asset.service";
import { CollectionService } from "@/services/collection.service";
import { ColorSearchService } from "@/services/color-search.service";
import { HealthService } from "@/services/health.service";
import { ImageUploadService } from "@/services/image-upload.service";
import { LoggerService } from "@/services/logger.service";
import { ObjectStorageService } from "@/services/object-storage.service";

const loggerService = new LoggerService();
const objectStorageService = new ObjectStorageService();

export const container = {
  db,
  healthService: new HealthService(),
  loggerService,
  objectStorageService,
  assetService: new AssetService({ objectStorageService }),
  collectionService: new CollectionService({ objectStorageService }),
  imageUploadService: new ImageUploadService(objectStorageService),
  colorSearchService: new ColorSearchService({
    objectStorageService,
    loggerService,
  }),
};

export type Container = typeof container;
export type ContainerCradle = Container;
