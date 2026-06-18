import { desc, eq } from "drizzle-orm";
import type { DbClient } from "@/db";
import { chatLogs } from "@/db/schema/chat-logs";

export interface ChatLogTurn {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  toolName?: string | null;
}

export interface ChatLogRepository {
  appendTurns(turns: ChatLogTurn[]): Promise<void>;
  listBySession(sessionId: string, limit?: number): Promise<ChatLogTurn[]>;
}

/** チャット運用ログの D1 リポジトリ。URL リポジトリと同じ Drizzle パターン。 */
export class D1ChatLogRepository implements ChatLogRepository {
  constructor(private readonly db: DbClient) {}

  async appendTurns(turns: ChatLogTurn[]): Promise<void> {
    if (turns.length === 0) return;
    await this.db.insert(chatLogs).values(
      turns.map((turn) => ({
        sessionId: turn.sessionId,
        role: turn.role,
        content: turn.content,
        toolName: turn.toolName ?? null,
      })),
    );
  }

  async listBySession(sessionId: string, limit = 100): Promise<ChatLogTurn[]> {
    const rows = await this.db
      .select()
      .from(chatLogs)
      .where(eq(chatLogs.sessionId, sessionId))
      .orderBy(desc(chatLogs.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      sessionId: row.sessionId,
      role: row.role as "user" | "assistant",
      content: row.content,
      toolName: row.toolName,
    }));
  }
}
