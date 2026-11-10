import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

import { env } from "@/config/env";

import { relations } from "./schema/relations";

let _db: ReturnType<typeof createDb> | undefined;

function createDb() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 10000,
  });
  return drizzle({ client: pool, relations });
}

export const db = new Proxy<ReturnType<typeof createDb>>(
  {} as ReturnType<typeof createDb>,
  {
    get(_, prop) {
      if (!_db) _db = createDb();
      return _db[prop as keyof ReturnType<typeof createDb>];
    },
  },
);

export type Database = typeof db;
