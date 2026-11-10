import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
    // When Vitest itself runs on Bun (a machine without Node), Bun resolves the
    // externalized `zod` import to its global install cache instead of this
    // package's node_modules, and that copy has no `z` export. Letting Vite
    // bundle zod avoids Bun's resolver. Under Node, as in CI, nothing changes.
    ...(process.versions.bun ? { server: { deps: { inline: [/zod/] } } } : {}),
  },
});
