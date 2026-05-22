import { apiError } from "./responses";
import type { NextResponse } from "next/server";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * 固定ウィンドウのレート制限。ウィンドウごとのカウンタを KV に持つ。
 * KV未設定時はフェイルオープン（制限しない）。
 */
export async function checkRateLimit(
  kv: KVNamespace | undefined,
  identifier: string,
): Promise<RateLimitResult> {
  if (!kv) {
    return { allowed: true, remaining: MAX_REQUESTS, resetAt: 0 };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % WINDOW_SECONDS);
  const key = `ratelimit:${identifier}:${windowStart}`;
  const current = Number((await kv.get(key)) ?? 0);
  const resetAt = windowStart + WINDOW_SECONDS;

  if (current >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt };
  }

  await kv.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS * 2 });
  return { allowed: true, remaining: MAX_REQUESTS - current - 1, resetAt };
}

/** レート制限に掛かっていれば 429 レスポンスを、通過なら null を返す。 */
export async function enforceRateLimit(
  kv: KVNamespace | undefined,
  identifier: string,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(kv, identifier);
  if (result.allowed) return null;

  const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
  const response = apiError(429, "レート制限を超えました。しばらく待って再試行してください");
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}
