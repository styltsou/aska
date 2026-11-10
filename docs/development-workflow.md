# Development Workflow

The repository is a Bun workspace: one `bun install` at the root installs every
package. CI runs the quality commands for the client, server, image pipeline,
URL-resource workers, and extension on pull requests and pushes to `main`, but
only for packages whose files changed (plus packages that depend on a changed
shared service). Changes to the root `package.json`, `bun.lock`, `bunfig.toml`,
or the workflow itself run every job. It also verifies the client production build and checks that
the server schema does not generate an uncommitted migration.

## Pre-commit Formatting

Running `bun install` from the repository root configures Git to use the tracked
`.githooks` directory. The pre-commit hook formats staged client, server, and
worker source files with Oxfmt. Any fixes are re-staged automatically.
The client Oxfmt configuration enables `sortTailwindcss` against `src/index.css`,
so the same pass also normalizes Tailwind class order.

## Tests

Every package exposes `bun run test`. Server unit tests live beside the code
they cover and do not require external infrastructure. Database-backed server
tests use `bun run test:integration`; they are excluded from the normal unit
suite and require `TEST_DATABASE_URL` to point to a disposable database.

```sh
cd apps/server && TEST_DATABASE_URL=postgresql://... bun run test:integration
```

The client and workers use Vitest with `--passWithNoTests` so package checks
remain valid even before a worker gains its first focused test.

Run the checks before pushing. The whole suite, with cached results for
unchanged packages, or one package:

```sh
bun run check
bunx turbo run lint typecheck format test --filter server
```
