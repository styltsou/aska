import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "@/config/env";

import { relations } from "./schema/relations";

export const db = drizzle(env.DATABASE_URL, { relations });

export type Database = typeof db;
