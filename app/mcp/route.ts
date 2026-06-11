import { NextRequest, NextResponse } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { validateShortenRequest } from "@/lib/validations/url";
import { verifyApiKey } from "@/lib/api/api-key";
import { enforceApiRateLimit } from "@/lib/api/rate-limit";
import { apiError, linkPayload } from "@/lib/api/responses";
import type { AppEnv } from "@/db";
import { buildService } from "@/lib/core/build";
import { ShortenError } from "@/lib/core/errors";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { setUserAttributes } from "@/lib/utils/telemetry";
import { scheduleOtelFlush } from "@/lib/utils/otel-flush";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureOtelInitialized } from "@/lib/otel/init";

const tracer = trace.getTracer("url-shortener");

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
 */
function buildMcpHandler(env: AppEnv, origin: string) {
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
      basePath: "", // エンドポイントは /mcp
      disableSse: true, // stateless運用。SSE(GET)は使わないのでRedisも不要
      maxDuration: 30,
      verboseLogs: false,
    },
  );
}

export async function POST(request: NextRequest) {
  const { env, ctx } = (await getCloudflareContext()) as unknown as {
    env: AppEnv;
    ctx: { waitUntil: (p: Promise<unknown>) => void };
  };
  ensureOtelInitialized(env);

  return tracer.startActiveSpan("mcp-request", async (span) => {
    try {
      await setUserAttributes(span, request, env);

      if (!verifyApiKey(request, env.API_KEY)) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Unauthorized" });
        return apiError(401, "APIキーが無効です");
      }

      const rateLimited = await enforceApiRateLimit(env);
      if (rateLimited) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Rate limited" });
        return rateLimited;
      }

      const handler = buildMcpHandler(env, request.nextUrl.origin);
      const response = await handler(request);
      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("MCP request error:", error);
      return apiError(500, "MCPリクエストの処理に失敗しました");
    } finally {
      span.end();
      scheduleOtelFlush(ctx);
    }
  });
}

/** stateless運用のため、SSEストリーム(GET)とセッション削除(DELETE)は提供しない。 */
export async function GET() {
  return NextResponse.json(
    { error: { message: "Method Not Allowed" } },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: { message: "Method Not Allowed" } },
    { status: 405, headers: { Allow: "POST" } },
  );
}
