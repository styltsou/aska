import { and, eq, inArray, isNull, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  imageAssets,
  imageColors,
  type ImageAssetVariants,
} from "@/db/schema";
import type {
  ColorSearchLocation,
  ColorSearchQueryColor,
  ColorSearchScope,
} from "@/dto/color-search.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { resolveCollectionTargetBySlug } from "@/services/collection/collection-target-resolver";

import { COLOR_SEARCH_CONFIG } from "./color-search-ranker";
import type { SearchPaletteColor } from "./color-assignment";

export type ScopedSearchImage = {
  assetId: number;
  location: ColorSearchLocation;
};

export type ResolvedColorSearchScope =
  | { type: "inbox" }
  | {
      type: "collection";
      collectionId: number;
      collectionSlug: string;
      parentFolderId: number | null;
      folderPath?: string;
    };

export type BroadCandidateAssets = {
  assetIds: number[];
  reachedSafetyCap: boolean;
};

export type SearchImageMetadata = {
  assetId: number;
  title: string | null;
  width: number;
  height: number;
  alt: string | null;
  blurDataURL: string | null;
  dominantColors: string[];
  variants: ImageAssetVariants;
};

export type SearchPaletteRow = SearchPaletteColor & {
  assetId: number;
};

type CandidateAssetRow = {
  asset_id: number;
};

/** Database-only access patterns for color search. */
export class ColorSearchRepository {
  async resolveScope(
    orgId: string,
    scope: ColorSearchScope,
  ): Promise<ResolvedColorSearchScope> {
    if (scope.type === "inbox") return { type: "inbox" };

    const target = await resolveCollectionTargetBySlug(
      orgId,
      scope.collectionSlug,
      scope.folderPath,
    );
    if (!target) {
      throw new AppError(ErrorCode.NOT_FOUND, "Collection not found");
    }

    const folderPath = target.pathFolderSlugs.join("/");
    return {
      type: "collection",
      collectionId: target.collection.id,
      collectionSlug: target.collection.slug,
      parentFolderId: target.parentFolderId,
      ...(folderPath ? { folderPath } : {}),
    };
  }

  async getScopedImageCount(
    orgId: string,
    scope: ResolvedColorSearchScope,
  ): Promise<number> {
    const scopedImages = this.scopedImagesRelation(orgId, scope);
    const result = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::text AS count
      FROM (${scopedImages}) scoped_images
    `);
    return Number(result.rows[0]?.count ?? 0);
  }

  async getImageLocations(
    orgId: string,
    scope: ResolvedColorSearchScope,
    assetIds: readonly number[],
  ): Promise<ScopedSearchImage[]> {
    if (assetIds.length === 0) return [];

    if (scope.type === "inbox") {
      const rows = await db
        .select({ assetId: assets.id })
        .from(assets)
        .where(
          and(
            eq(assets.organizationId, orgId),
            eq(assets.type, "image"),
            inArray(assets.id, [...assetIds]),
            notExists(
              db
                .select({ id: collectionNodes.id })
                .from(collectionNodes)
                .where(
                  and(
                    eq(collectionNodes.organizationId, orgId),
                    eq(collectionNodes.nodeType, "asset"),
                    eq(collectionNodes.assetId, assets.id),
                  ),
                ),
            ),
          ),
        );

      return rows.map((row) => ({
        assetId: row.assetId,
        location: {
          type: "inbox",
          nodeId: `image-${row.assetId}`,
          position: null,
        },
      }));
    }

    const rows = await db
      .select({
        assetId: assets.id,
        positionX: collectionNodes.positionX,
        positionY: collectionNodes.positionY,
      })
      .from(collectionNodes)
      .innerJoin(assets, eq(assets.id, collectionNodes.assetId))
      .where(
        and(
          eq(collectionNodes.organizationId, orgId),
          eq(collectionNodes.collectionId, scope.collectionId),
          eq(collectionNodes.nodeType, "asset"),
          eq(assets.organizationId, orgId),
          eq(assets.type, "image"),
          inArray(assets.id, [...assetIds]),
          scope.parentFolderId === null
            ? isNull(collectionNodes.parentFolderId)
            : eq(collectionNodes.parentFolderId, scope.parentFolderId),
        ),
      );

    return rows.map((row) => ({
      assetId: row.assetId,
      location: {
        type: "collection",
        collectionSlug: scope.collectionSlug,
        ...(scope.folderPath ? { folderPath: scope.folderPath } : {}),
        nodeId: `image-${row.assetId}`,
        position:
          row.positionX === null || row.positionY === null
            ? null
            : { x: row.positionX, y: row.positionY },
      },
    }));
  }

  /**
   * Retrieves complete-query candidates. Inbox searches begin with the
   * tenant-first GiST cube expression index; a small direct board begins with
   * scoped asset IDs. The safety cap is applied after grouping by asset, never
   * per selected color, so a common color cannot starve balanced palette
   * matches.
   */
  async findBroadCandidateAssets(
    orgId: string,
    scope: ResolvedColorSearchScope,
    queryColors: readonly ColorSearchQueryColor[],
  ): Promise<BroadCandidateAssets> {
    const queryColorValues = sql.join(
      queryColors.map(
        (color, index) =>
          sql`(
            ${index},
            ${color.oklabL}::double precision,
            ${color.oklabA}::double precision,
            ${color.oklabB}::double precision
          )`,
      ),
      sql`, `,
    );
    const scopedImagesCte =
      scope.type === "collection"
        ? sql`, scoped_images AS MATERIALIZED (
            ${this.scopedImagesRelation(orgId, scope)}
          )`
        : sql``;
    const candidateScope =
      scope.type === "inbox"
        ? sql`
            JOIN assets a
              ON a.id = ic.asset_id
              AND a.organization_id = ${orgId}
              AND a.type = 'image'
            WHERE NOT EXISTS (
              SELECT 1
              FROM collection_nodes cn
              WHERE cn.organization_id = ${orgId}
                AND cn.node_type = 'asset'
                AND cn.asset_id = ic.asset_id
            )
          `
        : sql`
            JOIN scoped_images scoped
              ON scoped.asset_id = ic.asset_id
            JOIN assets a
              ON a.id = ic.asset_id
              AND a.organization_id = ${orgId}
          `;
    const paletteCube = sql`cube(array[ic.oklab_l, ic.oklab_a, ic.oklab_b])`;
    const queryCube = sql`cube(array[q.oklab_l, q.oklab_a, q.oklab_b])`;
    const safetyLimit = COLOR_SEARCH_CONFIG.maxBroadCandidates + 1;

    const result = await db.execute<CandidateAssetRow>(sql`
      WITH query_colors(query_index, oklab_l, oklab_a, oklab_b) AS (
        VALUES ${queryColorValues}
      )${scopedImagesCte},
      candidate_matches AS MATERIALIZED (
        SELECT
          q.query_index,
          ic.asset_id,
          ${paletteCube} <-> ${queryCube} AS distance
        FROM query_colors q
        JOIN image_colors ic
          ON ic.organization_id = ${orgId}
          AND ${paletteCube} <@
               cube_enlarge(
                 ${queryCube},
                 ${COLOR_SEARCH_CONFIG.candidateRadius},
                 3
               )
          AND ${paletteCube} <-> ${queryCube}
              <= ${COLOR_SEARCH_CONFIG.candidateRadius}
        ${candidateScope}
      ),
      qualifying_assets AS (
        SELECT
          asset_id,
          MAX(distance) AS worst_distance,
          AVG(distance) AS average_distance
        FROM candidate_matches
        GROUP BY asset_id
        HAVING COUNT(DISTINCT query_index) = ${queryColors.length}
        ORDER BY worst_distance ASC, average_distance ASC, asset_id DESC
        LIMIT ${safetyLimit}
      )
      SELECT asset_id
      FROM qualifying_assets
      ORDER BY worst_distance ASC, average_distance ASC, asset_id DESC
    `);

    const reachedSafetyCap =
      result.rows.length > COLOR_SEARCH_CONFIG.maxBroadCandidates;
    return {
      assetIds: result.rows
        .slice(0, COLOR_SEARCH_CONFIG.maxBroadCandidates)
        .map((row) => Number(row.asset_id)),
      reachedSafetyCap,
    };
  }

  private scopedImagesRelation(orgId: string, scope: ResolvedColorSearchScope) {
    if (scope.type === "inbox") {
      return sql`
        SELECT a.id AS asset_id
        FROM assets a
        WHERE a.organization_id = ${orgId}
          AND a.type = 'image'
          AND NOT EXISTS (
            SELECT 1
            FROM collection_nodes cn
            WHERE cn.organization_id = ${orgId}
              AND cn.node_type = 'asset'
              AND cn.asset_id = a.id
          )
      `;
    }

    return sql`
      SELECT cn.asset_id
      FROM collection_nodes cn
      JOIN assets a
        ON a.id = cn.asset_id
        AND a.organization_id = ${orgId}
        AND a.type = 'image'
      WHERE cn.organization_id = ${orgId}
        AND cn.collection_id = ${scope.collectionId}
        AND cn.node_type = 'asset'
        AND ${
          scope.parentFolderId === null
            ? sql`cn.parent_folder_id IS NULL`
            : sql`cn.parent_folder_id = ${scope.parentFolderId}`
        }
    `;
  }

  async getPaletteColors(
    orgId: string,
    assetIds: readonly number[],
  ): Promise<SearchPaletteRow[]> {
    if (assetIds.length === 0) return [];

    return db
      .select({
        id: imageColors.id,
        assetId: imageColors.assetId,
        hex: imageColors.hex,
        oklabL: imageColors.oklabL,
        oklabA: imageColors.oklabA,
        oklabB: imageColors.oklabB,
        coverage: imageColors.coverage,
        salience: imageColors.salience,
        isAccent: imageColors.isAccent,
      })
      .from(imageColors)
      .where(
        and(
          eq(imageColors.organizationId, orgId),
          inArray(imageColors.assetId, [...assetIds]),
        ),
      );
  }

  async getImageMetadata(
    orgId: string,
    assetIds: readonly number[],
  ): Promise<SearchImageMetadata[]> {
    if (assetIds.length === 0) return [];

    return db
      .select({
        assetId: assets.id,
        title: assets.title,
        width: imageAssets.width,
        height: imageAssets.height,
        alt: imageAssets.alt,
        blurDataURL: imageAssets.blurDataURL,
        dominantColors: imageAssets.dominantColors,
        variants: imageAssets.variants,
      })
      .from(assets)
      .innerJoin(imageAssets, eq(imageAssets.assetId, assets.id))
      .where(
        and(
          eq(assets.organizationId, orgId),
          eq(assets.type, "image"),
          inArray(assets.id, [...assetIds]),
        ),
      );
  }
}
