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

See [the development workflow](../docs/development-workflow.md) and
[assets schema](../docs/server/assets-schema.md) for the shared conventions.
