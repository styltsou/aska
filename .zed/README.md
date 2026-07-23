# Zed Tooling

Install the **Oxc** extension from Zed's extension gallery once. The committed
`settings.json` configures its Oxfmt formatter and Oxlint language server for
JavaScript, JSX, TypeScript, TSX, JSON, and JSONC files.

Formatting and safe Oxlint fixes run on save. A single `.oxfmtrc.json` at the repo root
applies to all packages.

The package-local `oxfmt` and `oxlint` dependencies remain the source of truth
for command-line checks and CI.
