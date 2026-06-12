import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { validateShortenRequest } from "@/lib/validations/url";
import { linkPayload } from "@/lib/api/responses";
import type { AppEnv } from "@/db";
import { buildService } from "@/lib/core/build";
import { ShortenError } from "@/lib/core/errors";

/** MCPツールが返すテキストコンテンツを組み立てる。 */
function textResult(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

/**
 * Stateless な Streamable HTTP MCP ハンドラを組み立てる。
 *
 * 実装メモ:
 * - `mcp-handler` (Vercel MCP Adapter) を採用。v1.1.0 は MCP SDK の
 *   `WebStandardStreamableHTTPServerTransport`（Web標準 Request/Response ベース）を
 *   使うため、Cloudflare Workers (V8 isolate + nodejs_compat) でも動作する。
 *   Node の `http` サーバーを前提とする経路は SSE トランスポートのみで、
 *   `disableSse: true` により無効化している（Redis も不要になる）。
 * - `env` はリクエストごとに `getCloudflareContext()` から取得する必要があるため、
 *   ハンドラはモジュールスコープではなくリクエストごとに生成する。
 *   stateless（セッションなし）運用なので毎回生成してもインスタンス状態に依存しない。
 * - 認証・レート制限はここでは行わない。呼び出し元のルート
 *   （/mcp は APIキー認証、/api/chat/mcp はIPレート制限）が責務を持つ。
 * - `mcp-handler` はリクエストパスを `${basePath}/mcp` と照合するため、
 *   マウント先に応じた basePath を渡す（/mcp は ""、/api/chat/mcp は "/api/chat"）。
 */
export function buildMcpHandler(env: AppEnv, origin: string, basePath = "") {
  return createMcpHandler(
    (server) => {
      server.tool(
        "shorten_url",
        "URLを短縮し、短縮URLを返します。既に登録済みのURLの場合は既存の短縮URLを返します。",
        { url: z.string().describe("短縮したいURL (http/https)") },
        async ({ url }) => {
          const result = validateShortenRequest({ url });
          if (!result.success) {
            return textResult(result.error.errors[0].message, true);
          }
          try {
            const { record, isExisting } = await buildService(env).create(result.data.url);
            // KVキャッシュは登録時には書かない。リダイレクト側のread-through
            // (app/[code]/route.ts) が初回アクセス時に充填する。
            return textResult({ ...linkPayload(origin, record), isExisting });
          } catch (error) {
            if (error instanceof ShortenError && error.code === "UNSAFE_URL") {
              return textResult(
                `このURLは安全ではない可能性があるため登録できません (threatType: ${error.detail?.threatType})`,
                true,
              );
            }
            throw error;
          }
        },
      );

      server.tool(
        "resolve_url",
        "短縮コードから元のURLを取得します。",
        { code: z.string().describe("短縮コード (例: abc123)") },
        async ({ code }) => {
          const record = await buildService(env).get(code);
          if (!record) {
            return textResult("指定された短縮コードは存在しません", true);
          }
          return textResult(linkPayload(origin, record));
        },
      );
    },
    {
      serverInfo: { name: "url-shortener", version: "1.0.0" },
    },
    {
      basePath, // エンドポイントは `${basePath}/mcp`
      disableSse: true, // stateless運用。SSE(GET)は使わないのでRedisも不要
      maxDuration: 30,
      verboseLogs: false,
    },
  );
}
