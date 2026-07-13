# Development Workflow

Each package uses Bun for dependency installation and scripts. CI runs the same
quality commands for the client, server, and image pipeline on pull requests and
pushes to `main`.

## Pre-commit Formatting

Running `bun install` from the repository root configures Git to use the tracked
`.githooks` directory. The pre-commit hook formats staged client, server, and
image-pipeline source files with Oxfmt. Any fixes are re-staged automatically.
The client Oxfmt configuration enables `sortTailwindcss` against `src/index.css`,
so the same pass also normalizes Tailwind class order.

## Tests

Every package exposes `bun run test`. The server contains the initial Vitest
smoke test in `src/lib/note-metrics.test.ts`; add future tests next to the code
they cover. The client and image pipeline use Vitest with `--passWithNoTests`
until they have test files.

Run the package-local checks before pushing:

```sh
cd client && bun run lint && bun run typecheck && bun run format && bun run test
cd server && bun run lint && bun run typecheck && bun run format && bun run test
cd workers/image-pipeline && bun run lint && bun run typecheck && bun run format && bun run test
```
