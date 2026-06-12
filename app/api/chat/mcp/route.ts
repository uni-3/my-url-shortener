import { NextRequest, NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/api/rate-limit";
import { apiError } from "@/lib/api/responses";
import type { AppEnv } from "@/db";
import { buildMcpHandler } from "@/lib/mcp/handler";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { setUserAttributes } from "@/lib/utils/telemetry";
import { scheduleOtelFlush } from "@/lib/utils/otel-flush";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureOtelInitialized } from "@/lib/otel/init";

const tracer = trace.getTracer("url-shortener");

/**
 * チャットUI（ブラウザのPrompt API）向けの認証なしMCPプロキシ。
 * APIキーの代わりに、クライアントIP単位のレート制限で濫用を防ぐ。
 * MCPハンドラ本体は /mcp と共通（lib/mcp/handler.ts）。
 */
export async function POST(request: NextRequest) {
  const { env, ctx } = (await getCloudflareContext()) as unknown as {
    env: AppEnv;
    ctx: { waitUntil: (p: Promise<unknown>) => void };
  };
  ensureOtelInitialized(env);

  return tracer.startActiveSpan("chat-mcp-request", async (span) => {
    try {
      await setUserAttributes(span, request, env);

      const rateLimited = await enforceIpRateLimit(env, request);
      if (rateLimited) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Rate limited" });
        return rateLimited;
      }

      const handler = buildMcpHandler(env, request.nextUrl.origin, "/api/chat");
      const response = await handler(request);
      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("Chat MCP request error:", error);
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
