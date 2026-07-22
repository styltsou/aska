import { InjectionMode, asClass, asValue, createContainer } from "awilix";

import { db } from "@/db";
import { HealthService, type IHealthService } from "@/services/health.service";
import { LoggerService, type ILoggerService } from "@/services/logger.service";
import {
  CollectionService,
  type ICollectionService,
} from "@/services/collection.service";
import { AssetService, type IAssetService } from "@/services/asset.service";
import {
  ImageUploadService,
  type IImageUploadService,
} from "@/services/image-upload.service";
import {
  ObjectStorageService,
  type IObjectStorageService,
} from "@/services/object-storage.service";
import {
  ColorSearchService,
  type IColorSearchService,
} from "@/services/color-search.service";

type Cradle = {
  db: typeof db;
  healthService: IHealthService;
  loggerService: ILoggerService;
  assetService: IAssetService;
  collectionService: ICollectionService;
  objectStorageService: IObjectStorageService;
  imageUploadService: IImageUploadService;
  colorSearchService: IColorSearchService;
};

export const container = createContainer<Cradle>({
  injectionMode: InjectionMode.PROXY,
  strict: true,
}).register({
  db: asValue(db),
  healthService: asClass(HealthService).singleton(),
  loggerService: asClass(LoggerService).singleton(),
  assetService: asClass(AssetService).singleton(),
  collectionService: asClass(CollectionService).singleton(),
  objectStorageService: asClass(ObjectStorageService).singleton(),
  imageUploadService: asClass(ImageUploadService).singleton(),
  colorSearchService: asClass(ColorSearchService).singleton(),
});

export type Container = typeof container;
export type ContainerCradle = Cradle;
