import { fileURLToPath } from "node:url";

import { Resource } from "sst";

const databaseUrl = Resource.DatabaseUrl.value;
const queueUrl = Resource.UrlResolutionQueue.url;
if (!databaseUrl || !queueUrl) {
  throw new Error("The dev database or URL-resolution queue is not linked");
}

const serverDirectory = fileURLToPath(new URL("../server/", import.meta.url));
const backfill = Bun.spawn(["bun", "run", "backfill:resolver-version"], {
  cwd: serverDirectory,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    URL_RESOLUTION_QUEUE_URL: queueUrl,
  },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await backfill.exited;
if (exitCode !== 0) process.exit(exitCode);
