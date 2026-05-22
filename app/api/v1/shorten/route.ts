import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { validateShortenRequest } from "@/lib/validations/url";
import type { AppEnv } from "@/db";
import { buildService } from "@/lib/core/build";
import { ShortenError } from "@/lib/core/errors";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { setUserAttributes } from "@/lib/utils/telemetry";
import { scheduleOtelFlush } from "@/lib/utils/otel-flush";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ensureOtelInitialized } from "@/lib/otel/init";

const tracer = trace.getTracer("url-shortener");

function verifyApiKey(request: NextRequest, apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (token.length !== apiKey.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
}

export async function POST(request: NextRequest) {
  const { env, ctx } = (await getCloudflareContext()) as unknown as {
    env: AppEnv;
    ctx: { waitUntil: (p: Promise<unknown>) => void };
  };
  ensureOtelInitialized(env);

  return tracer.startActiveSpan("api-v1-shorten-url", async (span) => {
    try {
      await setUserAttributes(span, request, env);

      if (!verifyApiKey(request, env.API_KEY)) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Unauthorized" });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      let body: { url?: string };
      try {
        body = (await request.json()) as { url?: string };
      } catch {
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Invalid JSON" });
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const result = validateShortenRequest(body);
      if (!result.success) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.errors[0].message });
        return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
      }

      const { record, isExisting } = await buildService(env).create(result.data.url);

      const KV = env.URL_CACHE;
      if (KV) await KV.put(record.shortCode, record.longUrl, { expirationTtl: 86400 });

      span.setAttribute("short_code", record.shortCode);
      span.setAttribute("is_existing", isExisting);
      span.setStatus({ code: SpanStatusCode.OK });
      return NextResponse.json(
        isExisting
          ? { shortCode: record.shortCode }
          : { shortCode: record.shortCode, url: record.longUrl },
        { status: isExisting ? 200 : 201 },
      );
    } catch (error) {
      if (error instanceof ShortenError && error.code === "UNSAFE_URL") {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Unsafe URL: ${error.detail?.threatType}` });
        return NextResponse.json(
          { error: "このURLは安全ではない可能性があるため登録できません", threatType: error.detail?.threatType },
          { status: 403 },
        );
      }
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("API v1 URL shortening error:", error);
      return NextResponse.json({ error: "URLの短縮に失敗しました" }, { status: 500 });
    } finally {
      span.end();
      scheduleOtelFlush(ctx);
    }
  });
}
