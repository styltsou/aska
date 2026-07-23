import {
  bigint,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { organization, user } from "./auth";

export const assetTypeEnum = pgEnum("asset_type", ["image", "note"]);
export const collectionNodeTypeEnum = pgEnum("collection_node_type", [
  "asset",
  "folder",
]);
export const uploadSourceEnum = pgEnum("upload_source", [
  "direct",
  "remote_url",
]);
export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "uploaded",
  "processing",
  "completed",
  "failed",
]);
export const imageEnrichmentStatusEnum = pgEnum("image_enrichment_status", [
  "processing",
  "completed",
  "failed",
]);

export type StoredImageObjectVariant = {
  objectKey: string;
  width: number;
  height: number;
  contentType: string;
  sizeBytes: number;
};

export type StoredImageDataVariant = {
  dataUrl: string;
  width: number;
  height: number;
  contentType: string;
  sizeBytes: number;
};

export type ImageAssetVariants = {
  original?: StoredImageObjectVariant;
  display?: StoredImageObjectVariant;
  preview?: StoredImageObjectVariant;
};

export const collectionsTable = pgTable(
  "collections",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    description: text(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("collections_organizationId_idx").on(table.organizationId),
    uniqueIndex("collections_id_organizationId_uidx").on(
      table.id,
      table.organizationId,
    ),
    uniqueIndex("collections_organizationId_slug_uidx").on(
      table.organizationId,
      table.slug,
    ),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: assetTypeEnum().notNull(),
    title: varchar({ length: 255 }),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastAddedToInboxAt: timestamp("last_added_to_inbox_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("assets_organizationId_idx").on(table.organizationId),
    index("assets_organizationId_lastAddedToInboxAt_idx").on(
      table.organizationId,
      table.lastAddedToInboxAt,
    ),
    index("assets_type_idx").on(table.type),
    index("assets_createdAt_idx").on(table.createdAt),
    uniqueIndex("assets_id_organizationId_uidx").on(
      table.id,
      table.organizationId,
    ),
  ],
);

export const imageAssets = pgTable(
  "image_assets",
  {
    assetId: integer("asset_id")
      .primaryKey()
      .references(() => assets.id, { onDelete: "cascade" }),
    width: integer().notNull(),
    height: integer().notNull(),
    alt: text(),
    sourceLabel: varchar("source_label", { length: 120 }),
    sourceUrl: text("source_url"),
    variants: jsonb()
      .$type<ImageAssetVariants>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    blurDataURL: text("blur_data_url"),
    dominantColors: text("dominant_colors")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    variantStatus: imageEnrichmentStatusEnum("variant_status")
      .notNull()
      .default("processing"),
    paletteStatus: imageEnrichmentStatusEnum("palette_status")
      .notNull()
      .default("processing"),
    variantError: text("variant_error"),
    paletteError: text("palette_error"),
  },
  (table) => [
    check("image_assets_width_positive_chk", sql`${table.width} > 0`),
    check("image_assets_height_positive_chk", sql`${table.height} > 0`),
  ],
);

export const imageColors = pgTable(
  "image_colors",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id").notNull(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => imageAssets.assetId, { onDelete: "cascade" }),
    hex: varchar({ length: 7 }).notNull(),
    oklabL: doublePrecision("oklab_l").notNull(),
    oklabA: doublePrecision("oklab_a").notNull(),
    oklabB: doublePrecision("oklab_b").notNull(),
    // Fraction of visible source pixels assigned to this color. This is the
    // metric used for search ranking; palette ordering is kept separately.
    coverage: doublePrecision().notNull(),
    // A bounded presentation/search relevance score that can elevate small,
    // high-chroma accents without pretending they occupy more of the image.
    salience: doublePrecision().notNull(),
    isAccent: boolean("is_accent").notNull().default(false),
    extractionVersion: integer("extraction_version").notNull(),
  },
  (table) => [
    foreignKey({
      name: "image_colors_asset_org_fkey",
      columns: [table.assetId, table.organizationId],
      foreignColumns: [assets.id, assets.organizationId],
    }).onDelete("cascade"),
    index("image_colors_assetId_idx").on(table.assetId),
    index("image_colors_oklab_idx").on(
      table.oklabL,
      table.oklabA,
      table.oklabB,
    ),
    index("image_colors_organizationId_oklab_cube_gist_idx").using(
      "gist",
      table.organizationId,
      sql`cube(array[${table.oklabL}, ${table.oklabA}, ${table.oklabB}])`,
    ),
    check(
      "image_colors_coverage_range_chk",
      sql`${table.coverage} >= 0 AND ${table.coverage} <= 1`,
    ),
    check(
      "image_colors_salience_range_chk",
      sql`${table.salience} >= 0 AND ${table.salience} <= 1`,
    ),
  ],
);

export const uploads = pgTable(
  "uploads",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id").references(
      () => collectionsTable.id,
      {
        onDelete: "cascade",
      },
    ),
    parentFolderPath: text("parent_folder_path"),
    positionX: integer("position_x"),
    positionY: integer("position_y"),
    source: uploadSourceEnum().notNull(),
    status: uploadStatusEnum().notNull().default("pending"),
    originalObjectKey: text("original_object_key").notNull(),
    storageId: text("storage_id").notNull(),
    assetId: integer("asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    fileName: varchar("file_name", { length: 255 }),
    title: varchar({ length: 255 }),
    alt: text(),
    sourceLabel: varchar("source_label", { length: 120 }),
    sourceUrl: text("source_url"),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadUrlExpiresAt: timestamp("upload_url_expires_at"),
    errorMessage: text("error_message"),
    processingEtag: varchar("processing_etag", { length: 255 }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    finalizedAt: timestamp("finalized_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("uploads_organizationId_idx").on(table.organizationId),
    index("uploads_status_idx").on(table.status),
    uniqueIndex("uploads_originalObjectKey_uidx").on(table.originalObjectKey),
    uniqueIndex("uploads_storageId_uidx").on(table.storageId),
    index("uploads_assetId_idx").on(table.assetId),
    check("uploads_sizeBytes_positive_chk", sql`${table.sizeBytes} > 0`),
    check(
      "uploads_position_pair_chk",
      sql`(${table.positionX} is null and ${table.positionY} is null) or (${table.positionX} is not null and ${table.positionY} is not null)`,
    ),
  ],
);

export const noteAssets = pgTable("note_assets", {
  assetId: integer("asset_id")
    .primaryKey()
    .references(() => assets.id, { onDelete: "cascade" }),
  markdown: text().notNull(),
  color: varchar({ length: 32 }),
});

export const folders = pgTable(
  "folders",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("folders_organizationId_idx").on(table.organizationId),
    index("folders_slug_idx").on(table.slug),
    uniqueIndex("folders_id_organizationId_uidx").on(
      table.id,
      table.organizationId,
    ),
  ],
);

export const collectionNodes = pgTable(
  "collection_nodes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id").notNull(),
    parentFolderId: integer("parent_folder_id"),
    nodeType: collectionNodeTypeEnum("node_type").notNull(),
    assetId: integer("asset_id"),
    folderId: integer("folder_id"),
    positionX: integer("position_x"),
    positionY: integer("position_y"),
    depth: integer().default(0).notNull(),
    pathFolderIds: integer("path_folder_ids")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    pathFolderSlugs: text("path_folder_slugs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    pathFolderNames: text("path_folder_names")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "collection_nodes_collection_org_fkey",
      columns: [table.collectionId, table.organizationId],
      foreignColumns: [collectionsTable.id, collectionsTable.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "collection_nodes_asset_org_fkey",
      columns: [table.assetId, table.organizationId],
      foreignColumns: [assets.id, assets.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "collection_nodes_folder_org_fkey",
      columns: [table.folderId, table.organizationId],
      foreignColumns: [folders.id, folders.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "collection_nodes_parent_folder_in_collection_fkey",
      columns: [table.collectionId, table.parentFolderId],
      foreignColumns: [table.collectionId, table.folderId],
    }).onDelete("cascade"),
    index("collection_nodes_assetId_idx").on(table.assetId),
    index("collection_nodes_collectionId_nodeType_idx").on(
      table.collectionId,
      table.nodeType,
    ),
    index("collection_nodes_pathFolderIds_gin_idx").using(
      "gin",
      table.pathFolderIds,
    ),
    index("collection_nodes_pathFolderSlugs_gin_idx").using(
      "gin",
      table.pathFolderSlugs,
    ),
    uniqueIndex("collection_nodes_collectionId_assetId_uidx").on(
      table.collectionId,
      table.assetId,
    ),
    uniqueIndex("collection_nodes_assetId_uidx").on(table.assetId),
    uniqueIndex("collection_nodes_folderId_uidx").on(table.folderId),
    uniqueIndex("collection_nodes_collectionId_folderId_uidx").on(
      table.collectionId,
      table.folderId,
    ),
    uniqueIndex("collection_nodes_collectionId_folderPathSlugs_uidx")
      .on(table.collectionId, table.pathFolderSlugs)
      .where(sql`${table.nodeType} = 'folder'`),
    check(
      "collection_nodes_target_matches_node_type_chk",
      sql`
        (
          ${table.nodeType} = 'asset'
          and ${table.assetId} is not null
          and ${table.folderId} is null
        )
        or
        (
          ${table.nodeType} = 'folder'
          and ${table.folderId} is not null
          and ${table.assetId} is null
        )
      `,
    ),
    check("collection_nodes_depth_non_negative_chk", sql`${table.depth} >= 0`),
    check(
      "collection_nodes_position_pair_chk",
      sql`(${table.positionX} is null and ${table.positionY} is null) or (${table.positionX} is not null and ${table.positionY} is not null)`,
    ),
  ],
);
