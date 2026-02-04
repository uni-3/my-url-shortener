import { NextRequest, NextResponse } from "next/server";
import Sqids from "sqids";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { setUserAttributes } from "@/lib/utils/telemetry";

const sqids = new Sqids();
const tracer = trace.getTracer("url-shortener");

// 簡易的なメモリストレージ（本番環境ではDBを使用）
const urlStore = new Map<string, string>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  return tracer.startActiveSpan("api-redirect-url", async (span) => {
    try {
      await setUserAttributes(span, request);
      const { code } = await params;

      // コードをデコード
      const ids = sqids.decode(code);
      if (ids.length === 0) {
        return NextResponse.json(
          { error: "Invalid short code" },
          { status: 404 }
        );
      }

      const id = ids[0];
      const originalUrl = urlStore.get(String(id));

      if (!originalUrl) {
        return NextResponse.json(
          { error: "Short code not found" },
          { status: 404 }
        );
      }

      // 302 一時リダイレクト
      span.setStatus({ code: SpanStatusCode.OK });
      return NextResponse.redirect(originalUrl, { status: 302 });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        { error: "リダイレクトに失敗しました" },
        { status: 500 }
      );
    } finally {
      span.end();
    }
  });
}
