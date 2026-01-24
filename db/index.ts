import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/urls";

// Cloudflare D1 binding
const d1 = (process.env as any).DB as D1Database;

export const db = drizzle(d1, { schema });
