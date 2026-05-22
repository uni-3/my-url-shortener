import { NextResponse } from "next/server";
import type { UrlRecord } from "@/lib/core/repository";

/** API 共通のエラーレスポンス。エラーの種別は HTTP ステータスで表す。 */
export function apiError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: { message, ...extra } }, { status });
}

/** API v1 共通のリンク表現。 */
export function linkPayload(origin: string, record: UrlRecord) {
  return {
    code: record.shortCode,
    short_url: `${origin}/${record.shortCode}`,
    long_url: record.longUrl,
  };
}
