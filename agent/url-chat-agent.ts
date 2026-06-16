import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type StreamTextOnFinishCallback,
  type ToolSet,
  type UIMessage,
} from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { AppEnv } from "@/db";
import { getDb } from "@/db";
import { buildService } from "@/lib/core/build";
import { ShortenError } from "@/lib/core/errors";
import { validateShortenRequest } from "@/lib/validations/url";
import { D1ChatLogRepository, type ChatLogTurn } from "@/lib/core/chat-log-repository";

export type ChatEnv = Cloudflare.Env & {
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  SHORTENER_BASE_URL?: string;
};

const SYSTEM_PROMPT =
  "あなたはURL短縮アシスタントです。" +
  "URLの短縮を頼まれたら、必ず shorten_url ツールを使って短縮してください。" +
  "短縮コードから元のURLを調べるよう頼まれたら、必ず resolve_url ツールを使ってください。" +
  "URLを答えるときは、ツールの結果に含まれる short_url や long_url の値をそのまま使い、" +
  "自分でURLを作ったり変えたりしてはいけません。" +
  "マークダウン記法（バッククォートや**など）は使わず、プレーンテキストで簡潔に日本語で答えてください。";

/** API v1 と同じリンク表現（next/server を巻き込まないよう agent 内に最小定義）。 */
function linkPayload(origin: string, record: { shortCode: string; longUrl: string }) {
  return {
    code: record.shortCode,
    short_url: `${origin}/${record.shortCode}`,
    long_url: record.longUrl,
  };
}

/** UIMessage からプレーンテキストを取り出す（D1 ログ用）。 */
function uiMessageText(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * チャット用 Agent（Cloudflare agents SDK / AIChatAgent）。
 *
 * - 推論: Gemini（@ai-sdk/google、APIキーは secret）。
 * - ツール: 既存の URL 短縮サービス（buildService）を直接呼ぶ。
 * - 履歴: DO のメモリ/SQLite に保持されるが、フロントが毎回ランダムな session id で
 *   接続するためリロードで実質リセットされる。
 * - 運用ログ: ターン完了時に user/assistant を D1 (`chat_logs`) へ追記する。
 */
export class UrlChatAgent extends AIChatAgent<ChatEnv> {
  private get appEnv(): AppEnv {
    // ChatEnv は Cloudflare.Env 由来で DB が optional だが、バインディング済みなので実体は存在する。
    return this.env as unknown as AppEnv;
  }

  private get origin(): string {
    return this.env.SHORTENER_BASE_URL ?? "https://s.uni-3.app";
  }

  private buildTools(): ToolSet {
    const env = this.appEnv;
    const origin = this.origin;
    return {
      shorten_url: tool({
        description:
          "URLを短縮し、短縮URLを返します。既に登録済みのURLの場合は既存の短縮URLを返します。",
        inputSchema: z.object({ url: z.string().describe("短縮したいURL (http/https)") }),
        execute: async ({ url }) => {
          const result = validateShortenRequest({ url });
          if (!result.success) {
            return { error: result.error.errors[0].message };
          }
          try {
            const { record, isExisting } = await buildService(env).create(result.data.url);
            return { ...linkPayload(origin, record), isExisting };
          } catch (error) {
            if (error instanceof ShortenError && error.code === "UNSAFE_URL") {
              return {
                error: `このURLは安全ではない可能性があるため登録できません (threatType: ${error.detail?.threatType})`,
              };
            }
            throw error;
          }
        },
      }),
      resolve_url: tool({
        description: "短縮コードから元のURLを取得します。",
        inputSchema: z.object({ code: z.string().describe("短縮コード (例: abc123)") }),
        execute: async ({ code }) => {
          const record = await buildService(env).get(code);
          if (!record) {
            return { error: "指定された短縮コードは存在しません" };
          }
          return linkPayload(origin, record);
        },
      }),
    };
  }

  async onChatMessage(onFinish: StreamTextOnFinishCallback<ToolSet>) {
    const google = createGoogleGenerativeAI({
      apiKey: this.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    const tools = this.buildTools();
    // このターンのユーザー発話（最後の user メッセージ）を D1 ログ用に控える。
    const lastUserText = uiMessageText([...this.messages].reverse().find((m) => m.role === "user"));

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(this.messages),
      tools,
      stopWhen: stepCountIs(5),
      onFinish: async (event) => {
        await this.persistTurn(lastUserText, event.text, event.toolCalls?.map((c) => c.toolName));
        await onFinish(event);
      },
    });

    return result.toUIMessageStreamResponse();
  }

  /** user/assistant ターンを D1 運用ログへ追記する。失敗してもチャットは止めない。 */
  private async persistTurn(
    userText: string,
    assistantText: string,
    toolNames: string[] | undefined,
  ): Promise<void> {
    try {
      const turns: ChatLogTurn[] = [];
      if (userText) {
        turns.push({ sessionId: this.name, role: "user", content: userText });
      }
      if (assistantText) {
        turns.push({
          sessionId: this.name,
          role: "assistant",
          content: assistantText,
          toolName: toolNames && toolNames.length > 0 ? toolNames.join(",") : null,
        });
      }
      await new D1ChatLogRepository(getDb(this.appEnv)).appendTurns(turns);
    } catch (error) {
      console.error("[chat] failed to persist chat log to D1", error);
    }
  }
}
