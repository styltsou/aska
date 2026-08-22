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

export const assetTypeEnum = pgEnum("asset_type", [
  "image",
  "note",
  "link",
  "color",
]);
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
export const mediaCleanupJobStatusEnum = pgEnum("media_cleanup_job_status", [
  "pending",
  "processing",
]);
export const resourceResolutionStatusEnum = pgEnum(
  "resource_resolution_status",
  ["queued", "resolving", "partial", "ready", "failed"],
);
export const resourceResolutionAttemptStatusEnum = pgEnum(
  "resource_resolution_attempt_status",
  ["queued", "processing", "succeeded", "failed", "superseded", "cancelled"],
);
export const resourceResolutionTriggerEnum = pgEnum(
  "resource_resolution_trigger",
  ["paste", "manual_refresh", "stale_revalidation", "resolver_version"],
);
export const resourceMediaRoleEnum = pgEnum("resource_media_role", [
  "preview",
  "icon",
  "primary",
  "cover",
]);
export const resourceMediaStatusEnum = pgEnum("resource_media_status", [
  "discovered",
  "queued",
  "processing",
  "ready",
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

export type ResourceMediaVariants = {
  master?: StoredImageObjectVariant;
  display?: StoredImageObjectVariant;
  preview?: StoredImageObjectVariant;
};

export type ResourceFieldProvenance = Partial<
  Record<
    "canonicalUrl" | "title" | "description" | "siteName" | "resourceKind",
    { resolver: string; source: string }
  >
>;

export type ImageProvenance = {
  provider: "pexels" | "url";
  url: string;
  downloadUrl?: string;
  attribution?: {
    photoId: string;
    name: string;
    username?: string;
    profileUrl: string;
  };
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
    note: text(),
    sourceLabel: varchar("source_label", { length: 120 }),
    sourceUrl: text("source_url"),
    provenance: jsonb().$type<ImageProvenance>(),
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

/** A normalized, workspace-private representation of an external URL. */
export const externalResources = pgTable(
  "external_resources",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    normalizedUrl: text("normalized_url").notNull(),
    normalizedUrlHash: varchar("normalized_url_hash", { length: 64 }).notNull(),
    hostname: varchar({ length: 255 }).notNull(),
    canonicalUrl: text("canonical_url"),
    title: varchar({ length: 255 }),
    description: text(),
    siteName: varchar("site_name", { length: 255 }),
    resourceKind: varchar("resource_kind", { length: 32 })
      .notNull()
      .default("web_page"),
    resolverKey: varchar("resolver_key", { length: 120 })
      .notNull()
      .default("generic-html"),
    resolverVersion: varchar("resolver_version", { length: 64 })
      .notNull()
      .default("1"),
    resolutionGeneration: integer("resolution_generation").notNull().default(1),
    resolutionStatus: resourceResolutionStatusEnum("resolution_status")
      .notNull()
      .default("queued"),
    failureCategory: varchar("failure_category", { length: 64 }),
    fieldProvenance: jsonb("field_provenance")
      .$type<ResourceFieldProvenance>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    providerExtensions: jsonb("provider_extensions")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    resolvedAt: timestamp("resolved_at"),
    staleAt: timestamp("stale_at"),
    unreferencedAt: timestamp("unreferenced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("external_resources_id_organizationId_uidx").on(
      table.id,
      table.organizationId,
    ),
    uniqueIndex("external_resources_org_urlHash_uidx").on(
      table.organizationId,
      table.normalizedUrlHash,
    ),
    index("external_resources_org_status_idx").on(
      table.organizationId,
      table.resolutionStatus,
    ),
    index("external_resources_unreferencedAt_idx").on(table.unreferencedAt),
    check(
      "external_resources_generation_positive_chk",
      sql`${table.resolutionGeneration} > 0`,
    ),
  ],
);

/** The existing Aska asset/card subtype that points at a normalized resource. */
export const linkAssets = pgTable(
  "link_assets",
  {
    assetId: integer("asset_id")
      .primaryKey()
      .references(() => assets.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").notNull(),
    resourceId: integer("resource_id").notNull(),
    originalUrl: text("original_url").notNull(),
  },
  (table) => [
    foreignKey({
      name: "link_assets_asset_org_fkey",
      columns: [table.assetId, table.organizationId],
      foreignColumns: [assets.id, assets.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      name: "link_assets_resource_org_fkey",
      columns: [table.resourceId, table.organizationId],
      foreignColumns: [externalResources.id, externalResources.organizationId],
    }).onDelete("cascade"),
    index("link_assets_resourceId_idx").on(table.resourceId),
  ],
);

/** Durable, generation-guarded work for resolving one external resource. */
export const resourceResolutionAttempts = pgTable(
  "resource_resolution_attempts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id").notNull(),
    resourceId: integer("resource_id").notNull(),
    generation: integer().notNull(),
    trigger: resourceResolutionTriggerEnum().notNull(),
    status: resourceResolutionAttemptStatusEnum().notNull().default("queued"),
    resolverKey: varchar("resolver_key", { length: 120 }).notNull(),
    resolverVersion: varchar("resolver_version", { length: 64 }).notNull(),
    attempts: integer().notNull().default(0),
    enqueuedAt: timestamp("enqueued_at"),
    processingStartedAt: timestamp("processing_started_at"),
    finishedAt: timestamp("finished_at"),
    failureCategory: varchar("failure_category", { length: 64 }),
    httpStatus: integer("http_status"),
    diagnosticCode: varchar("diagnostic_code", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "resource_resolution_attempts_resource_org_fkey",
      columns: [table.resourceId, table.organizationId],
      foreignColumns: [externalResources.id, externalResources.organizationId],
    }).onDelete("cascade"),
    uniqueIndex("resource_resolution_attempts_resource_generation_uidx").on(
      table.resourceId,
      table.generation,
    ),
    index("resource_resolution_attempts_status_createdAt_idx").on(
      table.status,
      table.createdAt,
    ),
    check(
      "resource_resolution_attempts_generation_positive_chk",
      sql`${table.generation} > 0`,
    ),
  ],
);

/** Media discovered by a resolver, with role-specific processing semantics. */
export const externalResourceMedia = pgTable(
  "external_resource_media",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id").notNull(),
    resourceId: integer("resource_id").notNull(),
    role: resourceMediaRoleEnum().notNull(),
    ordinal: integer().notNull().default(0),
    sourceUrl: text("source_url").notNull(),
    sourceUrlHash: varchar("source_url_hash", { length: 64 }).notNull(),
    sourceResolver: varchar("source_resolver", { length: 120 }).notNull(),
    sourceMetadata: varchar("source_metadata", { length: 120 }).notNull(),
    processingProfile: varchar("processing_profile", { length: 64 }).notNull(),
    processingProfileVersion: varchar("processing_profile_version", {
      length: 32,
    })
      .notNull()
      .default("1"),
    generation: integer().notNull(),
    status: resourceMediaStatusEnum().notNull().default("discovered"),
    storageId: text("storage_id").notNull(),
    variants: jsonb()
      .$type<ResourceMediaVariants>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    blurDataURL: text("blur_data_url"),
    width: integer(),
    height: integer(),
    format: varchar({ length: 32 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    alt: text(),
    failureCategory: varchar("failure_category", { length: 64 }),
    enqueuedAt: timestamp("enqueued_at"),
    processingStartedAt: timestamp("processing_started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "external_resource_media_resource_org_fkey",
      columns: [table.resourceId, table.organizationId],
      foreignColumns: [externalResources.id, externalResources.organizationId],
    }).onDelete("cascade"),
    uniqueIndex("external_resource_media_resource_role_ordinal_uidx").on(
      table.resourceId,
      table.role,
      table.ordinal,
    ),
    uniqueIndex("external_resource_media_storageId_uidx").on(table.storageId),
    index("external_resource_media_status_createdAt_idx").on(
      table.status,
      table.createdAt,
    ),
    check(
      "external_resource_media_ordinal_non_negative_chk",
      sql`${table.ordinal} >= 0`,
    ),
    check(
      "external_resource_media_generation_positive_chk",
      sql`${table.generation} > 0`,
    ),
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
    provenance: jsonb().$type<ImageProvenance>(),
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

/**
 * Durable, retryable deletion work for media objects that have been replaced.
 *
 * This intentionally survives asset deletion: its only job is to remove
 * already-displaced S3 objects, not to retain any user-visible image history.
 */
export const mediaCleanupJobs = pgTable(
  "media_cleanup_jobs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    assetId: integer("asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),
    objectKeys: text("object_keys").array().notNull(),
    status: mediaCleanupJobStatusEnum("status").notNull().default("pending"),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    processingStartedAt: timestamp("processing_started_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("media_cleanup_jobs_status_nextAttemptAt_idx").on(
      table.status,
      table.nextAttemptAt,
    ),
    index("media_cleanup_jobs_assetId_idx").on(table.assetId),
  ],
);

export const noteAssets = pgTable("note_assets", {
  assetId: integer("asset_id")
    .primaryKey()
    .references(() => assets.id, { onDelete: "cascade" }),
  markdown: text().notNull(),
  color: varchar({ length: 32 }),
});

/**
 * A color swatch asset. `hex` is a normalized lowercase hex value: always
 * #rrggbb when opaque, #rrggbbaa only when transparency is present, so the
 * RGB identity is stable for future search/palette features.
 */
export const colorAssets = pgTable(
  "color_assets",
  {
    assetId: integer("asset_id")
      .primaryKey()
      .references(() => assets.id, { onDelete: "cascade" }),
    hex: varchar({ length: 9 }).notNull(),
    gradient: jsonb("gradient").$type<{
      from: string;
      to: string;
      angle: number;
      type?: "linear" | "radial";
      stops?: Array<{ color: string; position: number }>;
    }>(),
  },
  (table) => [
    check(
      "color_assets_hex_format_chk",
      sql`${table.hex} ~ '^#[0-9a-f]{6}([0-9a-f]{2})?$'`,
    ),
  ],
);

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
    index("collection_nodes_destination_contents_idx").on(
      table.organizationId,
      table.collectionId,
      table.parentFolderId,
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
