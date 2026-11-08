# Collection-node move follow-up

## Current finding

Asset moves currently delete the existing `collection_nodes` row and insert a
new one. This is not required by the schema or foreign keys. It resets the
row's `created_at` timestamp, which incorrectly makes an old asset appear as a
new item in collection and folder preview stacks.

Folders already update their placement row in place. Assets should follow the
same model:

- Inbox to collection: insert a new placement row.
- Move inside one collection: update the existing placement row, preserving its
  row ID and original collection-membership timestamp.
- Move between collections: update the row and explicitly decide whether the
  destination membership timestamp should become "now". The recommended
  behavior is yes, because it is newly added to that collection.

The client optimistic move cache also currently prepends moved assets to folder
and collection previews. Once the server-side timestamp behavior is corrected,
that cache transition must sort by the stable membership timestamp instead.

## Deferred scope

This is intentionally deferred from the Markdown preview and clipboard fixes.
Implement it with server integration coverage for same-collection moves,
cross-collection moves, and preview ordering.
