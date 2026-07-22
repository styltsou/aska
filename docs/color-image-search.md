# Color Image Search

## Status

The first color-search release is implemented in the API and client. It finds
images from their extracted palettes, rather than from filenames, tags, or the
compact `dominantColors` display cache.

## Product Behavior

The filter bar accepts up to five color swatches. The client converts each
six-digit sRGB hex value to OKLab and waits 200 milliseconds after a swatch
change before querying. React Query cancels an obsolete request through its
`AbortSignal`; the previous successful result remains visible while the next
palette is being ranked.

The available scopes are deliberately local:

- **Inbox:** images that have not been placed in a collection. Results replace
  the masonry retrieval view in relevance order without changing archive order.
- **Current collection or folder:** images directly on the visible board.
  Matching image cards remain fully visible. Non-matching images and notes are
  dimmed and noninteractive, while folders stay available for navigation. The
  navigator pans the existing canvas to the previous or next ranked match.

Filter selections are stored per Inbox, collection, or folder route. They do
not leak between archive retrieval and authored moodboards.

## API Contract

```txt
POST /api/v1/workspace/:workspaceSlug/images/search
```

The authenticated request accepts one to five OKLab values and one of these
scopes:

```json
{
  "colors": [{ "oklabL": 0.63, "oklabA": 0.22, "oklabB": 0.13 }],
  "scope": { "type": "inbox" }
}
```

```json
{
  "colors": [{ "oklabL": 0.63, "oklabA": 0.22, "oklabB": 0.13 }],
  "scope": {
    "type": "collection",
    "collectionSlug": "brand-study",
    "folderPath": "palette",
    "includeDescendants": false
  }
}
```

Each result returns a signed display URL, dimensions, metadata, the matched
palette entries and distances, relevance, and its board location. The response
also includes the adaptive cutoff, truncation status, and
`oklab-color-search-v1` algorithm version. The full schema is available from
the server's [OpenAPI document](./server/index.md#public-backend-docs).

## Retrieval and Ranking

1. The service validates and de-duplicates near-identical OKLab query colors.
2. It resolves the authenticated Inbox or exact collection/folder scope.
3. A PostgreSQL `cube` GiST index retrieves a broad set of nearby palette
   colors from `image_colors`; an Inbox query then excludes placed assets.
4. Candidates must contain a close match for every selected query color.
5. A minimum-cost one-to-one assignment prevents one palette color from
   satisfying several selected swatches. Relevance combines OKLab distance,
   palette coverage, and salience.
6. An adaptive absolute/relative quality cutoff ranks the retained candidates.
   Results are capped at 50, while the broad candidate set is safety capped at 400.
7. The service materializes only retained image metadata and signs the preview
   or display variants for response rendering.

The search is bounded by quality, not an arbitrary requirement to fill the
result limit. A low-quality palette match is omitted.

## Implementation Map

- `server/src/dto/color-search.dto.ts`: validated public contract.
- `server/src/routes/color-search.routes.ts` and
  `server/src/controllers/color-search.controller.ts`: authenticated HTTP
  entry point.
- `server/src/services/color-search.service.ts`: scope resolution, ranking,
  response materialization, and telemetry.
- `server/src/services/color-search/`: palette assignment, ranking, and
  PostgreSQL retrieval repository.
- `client/src/lib/oklab.ts`: matching sRGB-to-OKLab conversion.
- `client/src/api/color-search/`: typed API client and debounced React Query
  hook.
- `client/src/components/filter-bar/` and route components: filter state,
  loading status, Inbox retrieval, and collection navigator.

## Deliberate Boundaries

The first release does not search a collection subtree or an entire workspace,
does not persist a saved color query, and does not navigate across boards. It
also does not change canvas positions, collection membership, or Inbox order.
Those features need explicit product and navigation behavior beyond local
retrieval.

The original [delivery plan](../COLOR_IMAGE_SEARCH_PLAN.md) records the
decision process, acceptance criteria, and future evaluation corpus.
