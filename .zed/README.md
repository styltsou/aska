# Zed Tooling

Install the **Oxc** extension from Zed's extension gallery once. The committed
`settings.json` configures its Oxfmt formatter and Oxlint language server for
JavaScript, JSX, TypeScript, TSX, JSON, and JSONC files.

Formatting and safe Oxlint fixes run on save. The language server discovers
the nearest `.oxfmtrc.json` and `.oxlintrc.json`, so files in `client/` and
`server/` use their package-specific settings.

The package-local `oxfmt` and `oxlint` dependencies remain the source of truth
for command-line checks and CI.
