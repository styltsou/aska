# Development Workflow

Each package uses Bun for dependency installation and scripts. CI runs the
quality commands for the client, server, and image pipeline on pull requests and
pushes to `main`. It also verifies the client production build and checks that
the server schema does not generate an uncommitted migration.

## Pre-commit Formatting

Running `bun install` from the repository root configures Git to use the tracked
`.githooks` directory. The pre-commit hook formats staged client, server, and
image-worker source files with Oxfmt. Any fixes are re-staged automatically.
The client Oxfmt configuration enables `sortTailwindcss` against `src/index.css`,
so the same pass also normalizes Tailwind class order.

## Tests

Every package exposes `bun run test`. Server unit tests live beside the code
they cover and do not require external infrastructure. Database-backed server
tests use `bun run test:integration`; they are excluded from the normal unit
suite and require `TEST_DATABASE_URL` to point to a disposable database.

```sh
cd server && TEST_DATABASE_URL=postgresql://... bun run test:integration
```

The client and image pipeline use Vitest with `--passWithNoTests` until they
have test files.

Run the package-local checks before pushing:

```sh
cd client && bun run lint && bun run typecheck && bun run format && bun run test && bun run build
cd server && bun run lint && bun run typecheck && bun run format && bun run test
cd services/image-variants && bun run lint && bun run typecheck && bun run format && bun run test
cd services/image-palette && bun run lint && bun run typecheck && bun run format && bun run test
```
