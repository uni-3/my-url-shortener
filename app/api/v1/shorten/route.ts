import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { validateShortenRequest } from "@/lib/validations/url";
import { encodeId } from "@/lib/utils/sqids";
import { normalizeUrl } from "@/lib/utils/url";
import { generateRandomString } from "@/lib/utils/random";
import { checkUrlSafety } from "@/lib/api/safe-browsing";
import { getDb, AppEnv } from "@/db";
import { urls } from "@/db/schema/urls";
import { eq } from "drizzle-orm";
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

      const body = (await request.json()) as { url?: string };
      const result = validateShortenRequest(body);

      if (!result.success) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.errors[0].message });
        return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
      }

      const url = normalizeUrl(result.data.url);
      const db = getDb(env);
      const KV = env.URL_CACHE;

      const existing = await db.query.urls.findFirst({ where: eq(urls.longUrl, url) });
      if (existing) {
        if (KV) await KV.put(existing.shortCode, url, { expirationTtl: 86400 });
        span.setAttribute("short_code", existing.shortCode);
        span.setAttribute("is_existing", true);
        span.setStatus({ code: SpanStatusCode.OK });
        return NextResponse.json({ shortCode: existing.shortCode }, { status: 200 });
      }

      const safetyResult = await checkUrlSafety(url, env.GOOGLE_SAFE_BROWSING_API_KEY);
      if (!safetyResult.safe) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `Unsafe URL: ${safetyResult.threatType}` });
        return NextResponse.json(
          { error: "このURLは安全ではない可能性があるため登録できません", threatType: safetyResult.threatType },
          { status: 403 }
        );
      }

      const [inserted] = await db
        .insert(urls)
        .values({ longUrl: url, shortCode: `tmp-${Date.now()}-${generateRandomString(12)}` })
        .returning({ id: urls.id });

      const shortCode = encodeId(inserted.id);
      await db.update(urls).set({ shortCode }).where(eq(urls.id, inserted.id));

      if (KV) await KV.put(shortCode, url, { expirationTtl: 86400 });

      span.setAttribute("short_code", shortCode);
      span.setAttribute("is_existing", false);
      span.setStatus({ code: SpanStatusCode.OK });
      return NextResponse.json({ shortCode, url }, { status: 201 });
    } catch (error) {
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
