import { NextResponse } from "next/server";
import type { UrlRecord } from "@/lib/core/repository";

/** API 共通のエラーレスポンス { error: { code, message, ...extra } }。 */
export function apiError(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** API v1 共通のリンク表現。 */
export function linkPayload(origin: string, record: UrlRecord) {
  return {
    code: record.shortCode,
    short_url: `${origin}/${record.shortCode}`,
    long_url: record.longUrl,
  };
}
