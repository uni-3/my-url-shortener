import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * チャットの運用ログ。会話のライブ状態は Durable Object (AIChatAgent) が持つが、
 * 後から横断的に見返す・分析するためのログは中央集約できる D1 に追記する。
 * sessionId は DO インスタンス名（フロントがページロード毎に生成するランダムID）。
 */
export const chatLogs = sqliteTable("chat_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  toolName: text("tool_name"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
