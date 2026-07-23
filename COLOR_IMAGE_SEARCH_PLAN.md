# Color-Based Image Search Plan

## Delivery Status

The first increment is implemented across the server and client. It supports
one to five colors in the Inbox and the current collection or folder board,
with `includeDescendants: false`. The API uses indexed palette retrieval,
complete-palette assignment, adaptive quality cutoff, and a 50-result cap. The
client converts swatches to OKLab, debounces requests, retains the previous
result while a new palette is ranked, and provides a collection result
navigator without altering canvas positions.

Whole-workspace and recursive-folder scopes, saved searches, and cross-board
navigation remain deferred. See [Color Image Search](./docs/color-image-search.md)
for the maintained implementation documentation.

## Recommended Decisions

- Search `image_colors`, not `image_assets.dominant_colors`.
- Treat multiple selected colors as an `all` query: a useful result must contain
  a match for every requested color.
- Use indexed OKLab distance to retrieve candidates, then rerank whole images
  with distance, coverage, salience, and a worst-match penalty.
- Assign requested colors to distinct palette entries. This prevents one red
  palette entry from satisfying both a red and an orange query.
- Return results above a quality cutoff, subject to a safety cap. Do not force a
  minimum result count by weakening the query.
- Keep the result cap separate from relevance. The cap limits response work;
  distance and score gates decide whether an image is relevant at all.
- Make the filter bar search the current collection/folder canvas directly by
  default. Searching descendants or the whole collection must be an explicit
  scope change.
- Keep workspace-wide color search out of the canvas filter interaction. It is
  a retrieval workflow and should eventually live in global search while
  reusing the same endpoint and ranking service.
- Never reorder a collection canvas by relevance. Preserve positions and offer
  a ranked result navigator that can focus the canvas on a chosen image.

## Existing Foundation

The repository already has the important search data:

- `image_colors` stores `organization_id` and up to ten extracted palette
  entries per image.
- Every entry has `oklab_l`, `oklab_a`, `oklab_b`, `coverage`, `salience`,
  `is_accent`, and `extraction_version`.
- `image_colors_organizationId_oklab_cube_gist_idx` is a tenant-first
  multicolumn GiST index over `organization_id` and the three-dimensional
  OKLab point. It uses PostgreSQL's `cube` and `btree_gist` extensions.
- `image_colors_assetId_idx` supports inexpensive palette reads after candidate
  image IDs are known.
- Palette extraction version 2 deliberately preserves both broad coverage
  colors and small high-chroma accents.
- `image_assets.dominant_colors` is only a display cache sorted by salience. It
  does not contain the metrics needed for search ranking.
- Collection placements already contain `collection_id`, `parent_folder_id`,
  and cached folder paths, so direct and recursive scopes can be expressed
  without recursive SQL.

The existing three-column B-tree OKLab index is not a nearest-neighbor index.
The tenant-first GiST index is the relevant index for color-distance candidate
retrieval and prevents cross-organization palette scans.

## Search Semantics

### Input

- Accept one to five colors.
- Accept finite OKLab values named `oklabL`, `oklabA`, and `oklabB`.
- Validate `oklabL` in `[0, 1]` and `oklabA`/`oklabB` in a conservative
  supported range such as `[-0.5, 0.5]`.
- Collapse effectively duplicate query colors within a small distance epsilon.
  Return the normalized query colors in the response so behavior is explicit.
- Keep the client swatches as sRGB hex values for display, but convert them to
  OKLab before calling the endpoint. The conversion must have fixed reference
  vectors shared with the image-pipeline tests.

Multiple colors mean "contains all of these colors," not "contains any of
these colors." `any` can be added later as a separate mode, but it should not
be an implicit fallback when an `all` query has no results.

### Scope

Use one endpoint with an explicit scope object instead of separate ranking
implementations for Inbox and collections:

```ts
type ColorSearchScope =
  | { type: "inbox" }
  | {
      type: "collection";
      collectionSlug: string;
      folderPath?: string;
      includeDescendants: boolean;
    }
  | { type: "workspace" };
```

Scope meanings:

- `inbox`: images in the workspace with no collection placement.
- `collection`, `includeDescendants: false`: only image nodes whose
  `parent_folder_id` is the resolved current folder, or `NULL` at collection
  root.
- `collection`, `includeDescendants: true`: the current folder subtree. At
  collection root this is the entire collection.
- `workspace`: every image owned by the workspace, regardless of placement.

Every scope must be constrained by the authenticated workspace before image
metadata is returned. A collection or folder that does not belong to that
workspace must produce `404`, consistent with existing collection resolution.

## Endpoint Contract

Add:

```txt
POST /api/v1/workspace/:workspaceSlug/images/search
```

`POST` is appropriate because the query is structured, can contain several
floating-point vectors, and should not be encoded into a long URL.

Example request:

```json
{
  "colors": [
    { "oklabL": 0.628, "oklabA": 0.225, "oklabB": 0.126 },
    { "oklabL": 0.828, "oklabA": -0.171, "oklabB": 0.091 }
  ],
  "scope": {
    "type": "collection",
    "collectionSlug": "summer-campaign",
    "folderPath": "packaging",
    "includeDescendants": false
  }
}
```

The server returns every result above the cutoff up to a configured maximum of
50. The maximum is a transport safety cap, not the relevance rule. A search
may return fewer results because the remaining candidates do not meet the
cutoff. Return `truncated: true` if more than 50 results clear the cutoff or if
the broad candidate safety cap is reached; pagination can be added after there
is a demonstrated need to browse that many color matches.

Example response shape:

```json
{
  "query": {
    "colors": [
      { "oklabL": 0.628, "oklabA": 0.225, "oklabB": 0.126 },
      { "oklabL": 0.828, "oklabA": -0.171, "oklabB": 0.091 }
    ],
    "scope": {
      "type": "collection",
      "collectionSlug": "summer-campaign",
      "folderPath": "packaging",
      "includeDescendants": false
    }
  },
  "results": [
    {
      "image": {
        "id": "image-42",
        "url": "https://signed-preview-url",
        "width": 320,
        "height": 213,
        "title": "Reference",
        "alt": null,
        "blurDataURL": "data:image/webp;base64,...",
        "dominantColors": ["#d94732", "#75c56a"]
      },
      "relevance": 0.86,
      "matches": [
        {
          "queryColorIndex": 0,
          "paletteHex": "#d94732",
          "distance": 0.021
        },
        {
          "queryColorIndex": 1,
          "paletteHex": "#75c56a",
          "distance": 0.034
        }
      ],
      "location": {
        "type": "collection",
        "collectionSlug": "summer-campaign",
        "folderPath": "packaging",
        "nodeId": "image-42",
        "position": { "x": 840, "y": -120 }
      }
    }
  ],
  "meta": {
    "returned": 1,
    "cutoff": 0.36,
    "truncated": false
  },
  "algorithmVersion": "oklab-color-search-v1"
}
```

Only sign the preview or display variant required by the search UI. Do not sign
every original image URL. Batch-sign result object keys to avoid an N+1 storage
request pattern. Use `(relevance DESC, assetId DESC)` as the stable ordering and
round relevance consistently before serialization so repeated requests cannot
change order because of floating-point noise.

### Quality gates versus result caps

Keep four concepts separate in implementation and naming:

1. `candidateRadius` is a deliberately broad database retrieval boundary. It
   protects query cost and recall; passing it does not make an image relevant.
2. `maximumMatchDistance` is a narrower per-requested-color quality gate after
   full-palette assignment. If even one selected color is too far away, reject
   the image.
3. The final relevance `cutoff` combines an absolute score floor with a score
   relative to the best result. This removes weak results and the loose tail of
   an otherwise good result set.
4. `maxResults` is only a response and signing-work cap. Apply it last and never
   use it to decide relevance.

For example, if the current space contains 20 images, evaluate all 20. If four
pass the distance and relevance gates, return four. If none pass, return an
empty result. Being below `maxResults` must never cause all 20 images to be
returned.

Use `maxResults = 50` for the first increment. This keeps preview signing,
response size, and the ranked result navigator bounded. If users genuinely
need to browse more than 50 relevant matches, add pagination rather than
loosening the relevance gates or silently increasing the payload.

## Retrieval and Ranking Algorithm

### 1. Normalize the query

1. Validate the color count and numeric ranges.
2. Remove near-duplicate colors while preserving the first color's index.
3. Resolve the tenant-scoped search scope to collection/folder IDs.
4. Convert every query color to the same `cube(array[l, a, b])` expression used
   by the tenant-first GiST index.

### 2. Resolve scoped image IDs

Build a scoped image relation before returning any metadata:

- Inbox uses the existing "no collection node exists" rule.
- A direct collection location matches `collection_id` and the resolved
  `parent_folder_id`.
- A folder subtree uses the cached `path_folder_ids` array. Direct children and
  deeper descendants contain the target folder ID.
- Collection root with descendants matches all image placements in that
  collection.
- Workspace scope matches image assets by `assets.organization_id`.

Keep this relation to IDs and placement/location fields. Do not load or sign
image metadata until ranking has selected the final result set.

### 3. Retrieve broad candidates

Use a deliberately broad OKLab radius as a candidate boundary. A starting
`candidateRadius` around `0.16` is reasonable for evaluation, not a final
product truth and not a claim that every candidate is relevant.
Use the GiST index in two steps:

1. Apply an indexable bounding-cube containment predicate with
   `cube_enlarge(queryPoint, candidateRadius, 3)`.
2. Apply exact Euclidean cube distance with `<->` to discard bounding-box
   corners and order the nearby rows.

Conceptual SQL shape:

```sql
WITH query_colors(query_index, query_point) AS (
  VALUES
    (0, cube(array[$1, $2, $3])),
    (1, cube(array[$4, $5, $6]))
),
scoped_images AS MATERIALIZED (
  -- Tenant-checked asset IDs and placement/location fields.
  SELECT ...
)
SELECT
  q.query_index,
  ic.asset_id,
  ic.id AS palette_color_id,
  ic.coverage,
  ic.salience,
  ic.hex,
  cube(array[ic.oklab_l, ic.oklab_a, ic.oklab_b]) <-> q.query_point
    AS distance
FROM query_colors q
JOIN image_colors ic
  ON ic.organization_id = $tenant_id
 AND cube(array[ic.oklab_l, ic.oklab_a, ic.oklab_b])
     <@ cube_enlarge(q.query_point, $candidate_radius, 3)
JOIN scoped_images scoped ON scoped.asset_id = ic.asset_id
WHERE cube(array[ic.oklab_l, ic.oklab_a, ic.oklab_b]) <-> q.query_point
      <= $candidate_radius;
```

The final Drizzle query will need `sql` fragments for the `cube` expressions
and operators.

There are two useful physical query plans:

- For a small direct canvas, start from scoped asset IDs and use
  `image_colors_assetId_idx`. At ten palette rows per image, scoring all palette
  entries is inexpensive and cannot lose a valid result.
- For a large Inbox, recursive collection, or workspace search, start from
  query colors through the GiST bounding/KNN search, intersect with the scoped
  relation, and cap the broad candidate pool before full reranking.

For multi-color queries, group the indexed matches by asset and query-color
index first. Require a coarse match for every query color, order qualifying
assets by their worst and average nearest distances, and only then apply the
broad candidate cap. Never cap each color's candidate rows independently: a
very common color could consume that cap and exclude images that are strong,
balanced matches for the complete query.

Implement both repository paths only after `EXPLAIN (ANALYZE, BUFFERS)` on a
representative seed shows where the crossover is. A bounded scope count can
choose the plan. Do not assume the optimizer will choose the best direction
through a materialized scope CTE.

`image_colors` stores `organization_id` with a composite tenant-consistency
constraint to its parent asset. A multicolumn GiST index, backed by
`btree_gist`, places the tenant key before the OKLab cube so workspace-wide
searches do not scan palette colors belonging to other organizations.

### 4. Match the complete palette

After broad candidate IDs are known, batch-load all `image_colors` rows for
those IDs through `image_colors_assetId_idx`.

For each image, solve a small minimum-cost assignment:

- Each query color must map to one palette entry within `candidateRadius`.
- A palette entry can satisfy at most one query color.
- Minimize total perceptual distance, with coverage and salience used only as
  tie-breaking evidence.
- Reject the image unless every query color can be assigned.

There are at most five query colors and ten palette colors, so a pure bitmask
dynamic-programming matcher is bounded and easy to unit test. This is safer
than adding a general optimization dependency and materially improves
multi-color queries over independent `MIN(distance)` aggregation.

### 5. Calculate relevance

OKLab Euclidean distance remains the primary signal. For each assigned match
`i`, calculate:

```txt
distanceScore_i = exp(-0.5 * (distance_i / sigma)^2)
prominence_i = 0.70 + 0.15 * sqrt(coverage_i) + 0.15 * salience_i
matchScore_i = distanceScore_i * prominence_i
```

Start evaluation with `sigma = 0.075`. The prominence multiplier stays between
`0.70` and `1.00`, so a very visible color wins a tie but cannot rescue a poor
color match. The square root lets coverage help without erasing the value of a
small accent.

Combine all requested colors using both a geometric mean and the weakest
match:

```txt
geometricMean = exp(mean(log(matchScore_i)))
relevance = 0.80 * geometricMean + 0.20 * min(matchScore_i)
```

The geometric mean gives every selected color influence. The weakest-match
term prevents an image with one excellent match and one barely acceptable
match from ranking above a balanced palette.

Do not add favorite status, creation date, title, or canvas position to color
relevance. Use `asset_id` only as a deterministic final tie-breaker.

### 6. Apply an adaptive cutoff

Use three independent relevance protections after candidate retrieval:

1. Reject any image whose assigned color distance exceeds a narrower
   `maximumMatchDistance`.
2. Reject scores below an absolute relevance floor.
3. Reject scores that fall too far below the best result in this query.

An initial evaluation configuration can be:

```txt
candidateRadius = 0.16
maximumMatchDistance = 0.12
absoluteFloor = 0.24
relativeFloor = bestRelevance * 0.40
cutoff = max(absoluteFloor, relativeFloor)
maxResults = 50
```

These values are hypotheses and must live in a versioned server configuration,
not in the API contract. Tune them against a labeled corpus containing neutrals,
dark/light variants, broad backgrounds, small accents, and two-to-five-color
queries.

The absolute floor is essential for small or poor result spaces. A relative
floor alone is unsafe because the best of 20 unrelated images is still the
"best" result. If the best image is below the absolute floor or violates
`maximumMatchDistance`, return zero results.

Return zero results when nothing clears the floor. Do not silently switch from
`all` to `any`, lower the cutoff until something appears, or return unrelated
images to fill the configured maximum.

### 7. Materialize the response

1. Sort by relevance and stable asset ID tie-breaker.
2. Apply the cutoff and transport safety cap.
3. Batch-load image metadata and location metadata for only the selected set.
4. Batch-sign preview/display object keys.
5. Return the matched palette colors and distances for client presentation and
   ranking diagnostics.

## Backend Structure

Keep search out of the already broad asset and collection services:

```txt
server/src/dto/color-search.dto.ts
server/src/controllers/color-search.controller.ts
server/src/routes/color-search.routes.ts
server/src/services/color-search.service.ts
server/src/services/color-search/color-search.repository.ts
server/src/services/color-search/color-search-ranker.ts
server/src/services/color-search/color-assignment.ts
```

Implementation boundaries:

- DTO: Zod request validation and response types.
- Controller: authenticate, resolve the workspace through the existing
  collection service, call the search service, and wrap the response.
- Service: resolve scope, choose retrieval strategy, rank, threshold, apply the
  safety cap, batch-sign, and return typed results.
- Repository: Drizzle/raw SQL query shapes only.
- Ranker and assignment modules: pure deterministic functions with no database
  or Hono dependencies.
- Container: register `colorSearchService` as a singleton.
- OpenAPI: update the checked-in `server/src/openapi.json` contract.

Use an opaque algorithm version in logs and responses. Log request color count,
scope type, scoped-image estimate, candidate count, returned count, cutoff,
query duration, and algorithm version. Never log signed URLs.

## Scope Proposal

### Option A: current board only

Advantages:

- Matches the mental model of a filter attached to the current canvas.
- Avoids returning images that are not renderable on the current board.
- Preserves folder boundaries and makes result focusing straightforward.
- Is the simplest and fastest first endpoint integration.

Disadvantage: a user at collection root may assume "collection" includes images
inside folders. The UI must label this scope as `This board`, not just
`Collection`.

### Option B: current folder subtree

Advantages:

- Finds images in nested folders without leaving the current context.
- Works well for users who treat folders as organization rather than strict
  retrieval boundaries.

Disadvantages:

- Descendant results do not exist as nodes on the current XYFlow canvas.
- The client needs result locations, breadcrumbs, navigation, and delayed focus
  after moving to the result's folder.
- Showing descendants directly on the current canvas would duplicate nodes and
  violate the authored spatial model.

### Option C: entire workspace

Advantages: strongest retrieval behavior across the archive.

Disadvantages: it changes the user's task from filtering a composition to
finding assets elsewhere. Results need collection/folder context and actions
such as opening or moving an asset. This is too broad for a canvas-local filter
by default.

### Recommendation

Ship `This board` as the filter bar default. Add an explicit `Include nested
folders` or `This collection` scope only with the ranked result rail described
below. Reuse workspace scope later from global search, not as another default
state in the compact canvas filter bar.

For the first endpoint increment, implement `inbox` and direct `collection`
scope. Keep the request union ready for descendants, but do not expose a scope
the result UI cannot navigate correctly yet.

The target union above documents the intended stable endpoint shape. In the
first increment, the Zod request schema should accept `inbox` and `collection`
with `includeDescendants: false`; enable the other variants when their
navigation and performance requirements are implemented.

## Canvas UI/UX Proposal

The relevance order and the collection's spatial order represent different
things. The UI must preserve both instead of converting the canvas into a
temporary sorted grid.

### Filter interaction

- Keep selected swatches visible as hex colors; store both their display hex
  and derived OKLab query value.
- Limit selection to five colors and use `all` semantics.
- Debounce requests by roughly 200 ms and cancel superseded requests.
- Keep the last successful result set visible while a new query loads to avoid
  flashing the whole canvas.
- Show `No matches` without weakening the query. Removing a swatch or changing
  scope is an explicit user action.

### Current collection/folder canvas

- Never reorder, clone, or move result nodes.
- Keep every XYFlow node in local state so filtering cannot disturb positions,
  drag state, pending uploads, or fallback placement.
- The canvas specification defines de-emphasis rather than removal from the
  spatial map. Matching images remain fully visible; nonmatching image and note
  nodes become low-opacity and noninteractive. Folder cards remain usable for
  navigation.
- Do not automatically pan after every swatch click. Users commonly build a
  multi-color query one swatch at a time, and repeated viewport jumps are
  disorienting.

### Ranked result navigator

Extend the bottom filter bar with a stable result count and previous/next icon
buttons. The buttons walk results in relevance order and center the chosen node
at a useful, capped zoom without opening the image viewer.

The result count opens an optional right-side result rail:

- Show compact image previews sorted by relevance.
- Do not show raw numeric relevance scores.
- Show the matched palette swatches as visual evidence.
- In recursive/collection scope, show the folder breadcrumb for each result.
- Clicking a current-board result centers it and gives it a temporary selection
  treatment.
- Clicking a descendant result navigates to its folder, waits for that canvas
  to load, and then centers the node. It must not render the descendant on the
  parent canvas.
- On narrow viewports, use a bottom sheet instead of reducing the canvas to an
  unusable width.

This gives users immediate ranked retrieval without overwriting the authored
composition. It also solves the case where every match is outside the current
viewport.

### Inbox

The Inbox is already an archive-oriented masonry surface, so it can render the
filtered images directly in relevance order while colors are active. Clearing
the color query restores its normal date ordering. No separate canvas-focus
navigator is necessary, though the same result count and request state can be
reused.

## Test and Evaluation Plan

### Unit tests

- DTO rejects zero colors, more than five colors, non-finite values, invalid
  ranges, and malformed scope objects.
- Query normalization is permutation-stable and removes near-duplicates.
- Identical colors outrank merely nearby colors.
- Distance dominates coverage and salience.
- Coverage breaks close-distance ties.
- A small salient accent remains searchable.
- Every selected color is required.
- Distinct assignment prevents one palette entry from satisfying two colors.
- Query-color order does not change image relevance.
- A weak second color lowers multi-color relevance.
- Absolute and relative cutoffs behave deterministically.
- A scope smaller than `maxResults` still excludes every below-threshold image.
- A query whose best available image is below the absolute floor returns zero.
- Equal-score results use a stable asset ID tie-breaker.

### Database integration tests

- Results cannot cross workspace boundaries.
- Inbox excludes every placed asset.
- Direct collection scope excludes child-folder assets.
- Recursive scope includes direct and nested descendants but excludes siblings
  outside the chosen subtree.
- Root recursive scope includes the whole collection.
- Notes and folders never appear as image results.
- Deleted images and incomplete uploads cannot appear.
- Preview URLs are signed only for returned results.
- Result ordering is stable across repeated calls.

### Relevance corpus

Create a small checked-in fixture manifest referencing synthetic pipeline test
images and expected query judgments:

- large neutral background with a small saturated accent;
- same hue at several lightness values;
- neighboring hues with similar coverage;
- two-color images where one requested color is absent;
- gradients and photographic images with noisy palettes;
- three-to-five-color palette queries;
- near-duplicate selected colors.

Record precision at the returned cutoff and top-k ranking quality. Tune radius,
sigma, prominence weights, and adaptive thresholds from this corpus rather
than from a few manual examples.

### Performance verification

- Seed enough rows to represent at least one million `image_colors` entries and
  realistic tenant/scope distributions.
- Capture `EXPLAIN (ANALYZE, BUFFERS)` for direct-board, large Inbox, recursive
  collection, and workspace queries.
- Confirm the GiST `Index Cond` includes both `organization_id` and the OKLab
  bounding-cube predicate.
- Confirm the expression in SQL exactly matches the GiST index expression.
- Verify broad candidate caps bound memory and ranking CPU.
- Verify metadata loading and object signing are batched.
- Establish p50/p95 latency budgets before enabling workspace scope.

## Implementation Sequence

1. Add the DTO contract, pure color-assignment/ranking modules, and unit tests.
2. Add scope resolution and repository queries with integration tests.
3. Benchmark scope-first and GiST-first query plans, then select the crossover
   rule and candidate limits.
4. Add the service, controller, route, container registration, batch signing,
   structured metrics, and OpenAPI changes.
5. Add client API types/fetcher/hook and tested sRGB-to-OKLab conversion.
6. Connect Inbox swatches and render relevance-ordered masonry results.
7. Connect direct collection/folder filtering without modifying node positions.
8. Add the result navigator and focus behavior.
9. Add recursive collection scope only after breadcrumb navigation and
   post-navigation focus are complete.
10. Evaluate the relevance corpus, tune the versioned constants, and record the
    selected values and benchmark results in this document.

## Acceptance Criteria for the First Increment

- The authenticated endpoint accepts one to five OKLab colors.
- It supports Inbox and direct current collection/folder scope.
- All selected colors must be present through distinct palette matches.
- Results are sorted best-first and stop at the adaptive relevance cutoff.
- No result crosses workspace or requested placement boundaries.
- Search reads `image_colors` and uses a verified indexed query plan.
- Response image metadata and signed URLs are loaded in batches.
- Ranking, threshold, scope isolation, and stable ordering are tested.
- The checked-in OpenAPI document describes the endpoint.

## Decisions Still Requiring Product Validation

- Whether the second scope is `Include nested folders` from the current folder
  or always `This collection` from collection root.
- Whether a ranked result rail is necessary in the first UI increment or the
  compact previous/next navigator is sufficient for direct-board scope.
- Final distance, sigma, absolute-floor, and relative-floor values after corpus
  evaluation.
