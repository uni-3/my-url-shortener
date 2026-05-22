import { NextRequest, NextResponse } from "next/server";
import { validateShortenRequest } from "@/lib/validations/url";
import { verifyApiKey } from "@/lib/api/api-key";
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

export async function POST(request: NextRequest) {
  const { env, ctx } = (await getCloudflareContext()) as unknown as {
    env: AppEnv;
    ctx: { waitUntil: (p: Promise<unknown>) => void };
  };
  ensureOtelInitialized(env);

  return tracer.startActiveSpan("api-v1-create-link", async (span) => {
    try {
      await setUserAttributes(span, request, env);

      if (!verifyApiKey(request, env.API_KEY)) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Unauthorized" });
        return apiError("UNAUTHORIZED", "APIキーが無効です", 401);
      }

      let body: { url?: string };
      try {
        body = (await request.json()) as { url?: string };
      } catch {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Invalid JSON" });
        return apiError("INVALID_JSON", "リクエストボディが不正なJSONです", 400);
      }

      const result = validateShortenRequest(body);
      if (!result.success) {
        const message = result.error.errors[0].message;
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        return apiError("INVALID_URL", message, 400);
      }

      const { record, isExisting } = await buildService(env).create(result.data.url);

      const KV = env.URL_CACHE;
      if (KV) await KV.put(record.shortCode, record.longUrl, { expirationTtl: 86400 });

      span.setAttribute("short_code", record.shortCode);
      span.setAttribute("is_existing", isExisting);
      span.setStatus({ code: SpanStatusCode.OK });
      return NextResponse.json(linkPayload(new URL(request.url).origin, record), {
        status: isExisting ? 200 : 201,
      });
    } catch (error) {
      if (error instanceof ShortenError && error.code === "UNSAFE_URL") {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Unsafe URL: ${error.detail?.threatType}` });
        return apiError("UNSAFE_URL", "このURLは安全ではない可能性があるため登録できません", 403);
      }
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("API v1 create link error:", error);
      return apiError("INTERNAL", "URLの短縮に失敗しました", 500);
    } finally {
      span.end();
      scheduleOtelFlush(ctx);
    }
  });
}
