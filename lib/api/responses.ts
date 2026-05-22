import { NextResponse } from "next/server";
import type { UrlRecord } from "@/lib/core/repository";

/** API v1 共通のエラーレスポンス { error: { code, message } }。 */
export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** API v1 共通のリンク表現。 */
export function linkPayload(origin: string, record: UrlRecord) {
  return {
    code: record.shortCode,
    short_url: `${origin}/${record.shortCode}`,
    long_url: record.longUrl,
  };
}
