# Aska Client

The client is a React, TypeScript, Vite, Tailwind CSS, and shadcn/ui
application. It uses TanStack Router and React Query for navigation and server
state.

## Run Locally

```sh
bun install
bun run dev
```

## Quality Checks

```sh
bun run lint
bun run typecheck
bun run format
bun run test
```

`typecheck` explicitly checks both the browser (`tsconfig.app.json`) and Vite
(`tsconfig.node.json`) projects. Oxfmt is the formatter and also normalizes
Tailwind class order through `src/index.css`.

## Data Semantics

Collection and folder counts represent descendant assets: images and notes
count; folders do not. Mutations update collection cards, folder cards, and the
sidebar optimistically, then reconcile with the API. Folder and collection
previews carry stable asset IDs so optimistic updates can replace or remove the
correct preview.

## Color Image Search

The filter bar keeps selected colors scoped to the visible Inbox, collection,
or folder. It converts display hex colors to OKLab, debounces the typed color
search request, and uses React Query cancellation plus previous data to avoid
flicker between palette changes. Inbox results are a ranked retrieval view;
collection results dim non-matches in place and use the canvas navigator to
focus ranked matches. The API and ranking details are in
[Color Image Search](../docs/color-image-search.md).

## Draft Recovery

Unsaved create-note and image-upload dialogs retain a tab-scoped recovery draft
for 30 minutes. Drafts are scoped to the workspace and destination, so reopening
the matching dialog after navigation or a refresh restores its input. Only the
header-owned dialogs reopen automatically after a browser refresh; other entry
points restore the draft when opened. Explicit cancellation, emptying a note,
and successful submission clear the corresponding draft.

Image drafts use IndexedDB to retain selected `File` objects. Note drafts use
`sessionStorage`, since they contain text only.

See [the development workflow](../docs/development-workflow.md) and
[assets schema](../docs/server/assets-schema.md) for the shared conventions.
