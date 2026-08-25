import { fileURLToPath } from "node:url";

import { Resource } from "sst";

const databaseUrl = Resource.DatabaseUrl.value;
if (!databaseUrl) {
  throw new Error("The linked DatabaseUrl secret is empty");
}
console.info(`Migrating database host: ${new URL(databaseUrl).hostname}`);

const serverDirectory = fileURLToPath(new URL("../server/", import.meta.url));
const migration = Bun.spawn(
  ["bun", "node_modules/drizzle-kit/bin.cjs", "migrate"],
  {
    cwd: serverDirectory,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);

const exitCode = await migration.exited;
if (exitCode !== 0) process.exit(exitCode);
