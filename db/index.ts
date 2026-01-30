import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/urls";
import { Env } from "@/lib/types/env";

// Cloudflare D1 binding
const env = process.env as unknown as Env;
const d1 = env.DB;

export const db = drizzle(d1, { schema });
