import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(),
  count: integer("count").notNull(),
  windowStart: integer("window_start").notNull(),
});
