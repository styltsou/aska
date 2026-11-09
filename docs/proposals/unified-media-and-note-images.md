# Unified Media and Note Images

**Status:** Proposed (November 2026). Nothing in this document is implemented.

## Summary

Notes should support uploaded images, similar to Notion. Rather than adding a
fourth image-handling path, introduce one `media` record for every stored image
the workspace owns, let owners (image assets, link resources, videos, notes)
link to it, and run all processing and future indexing on media IDs.

Note images are uploaded to the **workspace**, referenced from note markdown as
`media:N` tokens, and attached to the note when the note is saved. This removes
any dependency on the note already existing, which matters because notes are
created lazily by autosave.

## Goal

Process and understand each image's pixels once, whoever owns the image.

An image asset, a link preview, a video poster, and a picture pasted into a note
are all "a stored image with renditions and, later, an embedding". Ownership is
a separate relationship on top of that.

## Current state

| Source | Database record | Processing |
| --- | --- | --- |
| Image uploads; Pexels, Unsplash, and remote imports | `uploads` + `assets` + `image_assets.variants` (jsonb) | S3 `original.*` event → `ImageUploadTopic` → variants and palette workers |
| Link previews and favicons | `external_resource_media` (role, profile, generation, status) | Direct command to the same variants worker with `link-preview-v2` / `icon-v1` profiles |
| Video posters and storyboards | `video_uploads` + `video_assets.poster` (jsonb) | Sharp code inside `video-processor` |
| Note images | A remote HTTPS URL in note markdown | None; the editor hotlinks the URL |

See [Background Tasks and Events](../task-architecture.md),
[Image Pipeline Reliability](../server/image-pipeline-reliability.md), and
[URL Unfurling](../server/url-unfurling.md) for the implemented behavior.

Observations:

- **Processing is mostly unified already.** One variants worker serves uploads
  and link media through profiles. Only video posters have their own rendition
  code.
- **Records are not unified.** There are three shapes for "an image file we
  own" and two upload tables. The `uploads` table also mixes "these bytes are
  arriving" with "place the asset at x,y in collection Z", which is why it
  cannot be reused for note images.
- **Current note images are a liability.** Hotlinked URLs bypass private
  CloudFront delivery, expose viewers' IP addresses to third-party hosts, break
  when the source disappears, and cannot be indexed.

## Proposed model

### 1. A `media` table

One row per stored file representation, modeled on `external_resource_media`:

- `id`, `organization_id`, `storage_id` (unique)
- `kind` (`image` initially)
- `original_object_key`, `content_type`, `size_bytes`, `width`, `height`
- `variants` (jsonb), `blur_data_url`
- `processing_profile`, `processing_profile_version`, `generation`
- `status` (`pending_upload`, `processing`, `ready`, `failed`), failure category
- `created_by_user_id`, timestamps

Storage keys follow the existing contract in
[Image Delivery Architecture](../image-delivery-architecture.md):
`{workspaceId}/{storageId}/original.{ext}` plus sibling renditions.

### 2. Owners link to media

Media never knows its owners. Ownership lives in link tables. For notes:

```text
note_media(note_asset_id, media_id, organization_id)
  unique (note_asset_id, media_id)
  composite FKs to assets(id, organization_id) and media(id, organization_id)
```

This mirrors `note_references`. Other owners can migrate later:
`image_assets.media_id`, `external_resource_media` → `media` + a resource link,
`video_assets.poster_media_id`.

### 3. Note images belong to the note, not the archive

Note images do not appear as Inbox cards, do not count toward collection
badges, and are not color-search results on their own. They are deleted
together with the note.

A later "Save to archive" action can promote a note image into a full image
asset by creating an `image_assets` owner for the same media.

Rationale: a screenshot pasted into a note is part of the note's content, not a
new visual reference. Semantic search can still find it, and the result opens
the note.

### 4. The pipeline works on media IDs

- Add a `note-image-v1` profile (display, preview, blur) to the variants worker.
- Send note-image work as a direct ID-and-generation command, like resource
  media, not through the S3 event fan-out. The fan-out recognises work by key
  shape (`original.*` versus `master.webp`), which becomes fragile as kinds are
  added.
- Note images do not go through palette extraction unless they are promoted.

## Upload and autosave flow

```text
paste or drop image
  → POST /api/v1/workspace/:slug/media            (no note ID needed)
  ← { mediaId, presigned PUT URL }
  → editor inserts an image node referencing media:123
    (shows a local blob: URL while uploading; never serialized)
  → browser PUTs the bytes
  → API confirms the upload and sends a render command
  → variants worker → media status becomes ready

note autosave (create or update)
  → server extracts media:N references from the markdown
  → verifies every referenced media belongs to the workspace
  → syncs note_media in the same transaction as the content write
```

Markdown stores `media:N`, never a delivery URL. The URL is resolved when the
note is rendered or exported, consistent with the rule that the database stores
object keys rather than URLs.

## Edge cases

| Case | Behavior |
| --- | --- |
| Note does not exist yet | Note creation runs the same reference sync, so no special case. |
| Note saves before the upload finishes | The reference is already a valid ID. The editor shows a placeholder, then the image or an error state. |
| Upload fails | The node shows a retry or remove state. The media row is eventually garbage-collected. |
| Image removed, then restored with undo | Nothing is deleted immediately. Unlinked media is removed only after a grace period. |
| Note deleted, or an empty create draft discarded | Links cascade away; the media becomes unlinked and is cleaned up later. |
| Same image copied into another note | Two links to one media row. It is deleted only when no links remain. |
| Pasted into a note in another workspace | The server rejects the foreign reference, or copies the media into the destination workspace. |
| Image-only note | `hasSaveableNote` currently checks only title and text. It must count image references as content, or an image-only note is treated as empty and deleted. |
| Edit conflicts | Conflict handling keeps the local draft. References in it remain valid because media is not deleted during the grace period. |
| AI rewrite and follow-ups | AI edits must preserve `media:N` tokens exactly. Add tests: models drop or alter opaque tokens. |
| Existing hotlinked images | Ingest them through the SSRF-safe remote fetch path so they become media too. |

### Orphan cleanup

The existing `MediaCleanup` cron finds media that has no owner links and was
created or last unlinked more than a grace period ago (for example 24 hours),
then deletes its objects and row. Use `media_cleanup_jobs` for the deletion
itself so it stays retryable.

## Semantic indexing

- **Media-level understanding:** image embeddings, OCR text, and captions are
  stored per media row. One indexing worker covers note images, image assets,
  link previews, and video posters. A media hit is mapped to its owners (an
  asset or a note) at query time.
- **Owner-level text:** note bodies and link article text are chunked into
  something like
  `search_chunks(owner_type, owner_id, chunk_index, content, content_hash, embedding)`.
- **Storage:** pgvector in the existing Postgres database, alongside the `cube`
  extension already used for color search.
- **Queue:** indexing gets its own lane, as [Background Tasks and
  Events](../task-architecture.md) already anticipates.
- **Autosave:** never enqueue indexing on every save. Mark the owner dirty with
  a content hash; the indexer picks it up after a quiet period and skips it if
  the hash is unchanged.

The current `ilike`-based workspace search is adequate until this exists.
Semantic search would replace it rather than build on it.

## Architecture observations

### Outgrown

- **Note editor components.** `note-detail-drawer.tsx` (~2,170 lines) and
  `note-rich-text.tsx` (~3,270 lines) hold the create, save, conflict, and
  delete-empty logic in many refs (`committedNoteRef`, `editRevisionRef`,
  `deletingNoteRef`, `syncedNoteIdRef`, `conflictRef`, `createdNote`).
  Adding upload state there would be risky. Extract the save logic into a plain,
  testable controller outside React **before** adding note images.
- **Two upload tables and three media record shapes.** Build note images on
  `media`, then migrate image assets, link media, and video posters when those
  areas are next touched. No big-bang migration is needed.

### Minor duplication

- `video-processor` generates poster renditions with its own Sharp code. It
  could store the poster frame as media and let the variants worker produce
  renditions.

### Worth keeping

- Generation guards and claims, HMAC worker callbacks, one DLQ per lane, and the
  rule against adding a queue per feature. These are the right amount of
  robustness for at-least-once delivery.

## Suggested order

1. Extract the note save controller out of the drawer component.
2. Add the `media` and `note_media` tables, the upload endpoint, and the
   `note-image-v1` profile.
3. Replace the editor's image node with a media-backed node; sync references on
   note save; fix `hasSaveableNote`.
4. Add orphan cleanup for unlinked media.
5. Ingest existing hotlinked note images.
6. Later: migrate the other owners to `media`, then build the indexing lane.

## Open questions

- Should promoted note images keep a link back to the note they came from?
- Should note images be included in workspace storage-usage totals the same way
  as image assets?
- Is 24 hours the right grace period, given that conflicted drafts can be
  restored later from local storage?
