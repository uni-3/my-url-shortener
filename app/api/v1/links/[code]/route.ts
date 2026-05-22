import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api/api-key";
import { enforceApiRateLimit } from "@/lib/api/rate-limit";
import { apiError, linkPayload } from "@/lib/api/responses";
import type { AppEnv } from "@/db";
import { buildService } from "@/lib/core/build";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { setUserAttributes } from "@/lib/utils/telemetry";
import { scheduleOtelFlush } from "@/lib/utils/otel-flush";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureOtelInitialized } from "@/lib/otel/init";

const tracer = trace.getTracer("url-shortener");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { env, ctx } = (await getCloudflareContext()) as unknown as {
    env: AppEnv;
    ctx: { waitUntil: (p: Promise<unknown>) => void };
  };
  ensureOtelInitialized(env);

  return tracer.startActiveSpan("api-v1-get-link", async (span) => {
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

      const { code } = await params;
      span.setAttribute("short_code", code);

      const record = await buildService(env).get(code);
      if (!record) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Not found" });
        return apiError(404, "指定された短縮コードは存在しません");
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return NextResponse.json(linkPayload(new URL(request.url).origin, record), { status: 200 });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("API v1 get link error:", error);
      return apiError(500, "リンクの取得に失敗しました");
    } finally {
      span.end();
      scheduleOtelFlush(ctx);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { env, ctx } = (await getCloudflareContext()) as unknown as {
    env: AppEnv;
    ctx: { waitUntil: (p: Promise<unknown>) => void };
  };
  ensureOtelInitialized(env);

  return tracer.startActiveSpan("api-v1-delete-link", async (span) => {
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

      const { code } = await params;
      span.setAttribute("short_code", code);

      const deleted = await buildService(env).delete(code);
      if (!deleted) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Not found" });
        return apiError(404, "指定された短縮コードは存在しません");
      }

      // 削除後もキャッシュが残ると最大1日リダイレクトし続けるため消去する
      const KV = env.URL_CACHE;
      if (KV) await KV.delete(code);

      span.setStatus({ code: SpanStatusCode.OK });
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("API v1 delete link error:", error);
      return apiError(500, "リンクの削除に失敗しました");
    } finally {
      span.end();
      scheduleOtelFlush(ctx);
    }
  });
}
