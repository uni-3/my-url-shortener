import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { urls } from "@/db/schema/urls";
import { eq } from "drizzle-orm";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("url-shortener");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  return tracer.startActiveSpan("redirect-url", async (span) => {
  const { code } = await params;
  span.setAttribute("short_code", code);

  // KV Binding
  const KV = (process.env as any).URL_CACHE as KVNamespace;

  try {
    // 1. キャッシュを確認
    if (KV) {
      const cachedUrl = await KV.get(code);
      if (cachedUrl) {
        return NextResponse.redirect(cachedUrl, 302);
      }
    }

    // 2. キャッシュミスの場合、DBを確認
    const entry = await db.query.urls.findFirst({
      where: eq(urls.shortCode, code),
    });

    if (!entry) {
      notFound();
    }

    // 3. キャッシュを更新 (有効期限1日)
    if (KV) {
      await KV.put(code, entry.longUrl, { expirationTtl: 86400 });
    }

    const response = NextResponse.redirect(entry.longUrl, 302);
    span.setStatus({ code: SpanStatusCode.OK });
    return response;
  } catch (error: any) {
    if (error.digest === "NEXT_NOT_FOUND") {
      span.setStatus({ code: SpanStatusCode.OK });
      throw error;
    }
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    console.error("Redirect error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    span.end();
  }
  });
}
