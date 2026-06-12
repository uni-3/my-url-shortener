import { sql } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { getDb, type AppEnv, type DbClient } from "@/db";
import { rateLimits } from "@/db/schema/rate-limits";
import { apiKeyId, sha256Hex } from "./api-key";
import { apiError } from "./responses";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

export interface RateLimitResult {
  allowed: boolean;
  resetAt: number;
}

/** ウィンドウ単位のリクエストカウンタ。 */
export interface RateLimitStore {
  /** id のカウンタをアトミックに +1 し更新後の値を返す。ウィンドウが変われば 1 から数え直す。 */
  increment(id: string, windowStart: number): Promise<number>;
}

/** D1 の単一文 upsert でカウンタをアトミックに更新する。D1 は書き込みを直列化するため競合しない。 */
export class D1RateLimitStore implements RateLimitStore {
  constructor(private readonly db: DbClient) {}

  async increment(id: string, windowStart: number): Promise<number> {
    const [row] = await this.db
      .insert(rateLimits)
      .values({ id, count: 1, windowStart })
      .onConflictDoUpdate({
        target: rateLimits.id,
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} = ${windowStart} THEN ${rateLimits.count} + 1 ELSE 1 END`,
          windowStart,
        },
      })
      .returning({ count: rateLimits.count });
    return row.count;
  }
}

export async function checkRateLimit(
  store: RateLimitStore,
  identifier: string,
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % WINDOW_SECONDS);
  const count = await store.increment(identifier, windowStart);
  return { allowed: count <= MAX_REQUESTS, resetAt: windowStart + WINDOW_SECONDS };
}

export async function enforceRateLimit(
  store: RateLimitStore,
  identifier: string,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(store, identifier);
  if (result.allowed) return null;

  const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
  const response = apiError(429, "レート制限を超えました。しばらく待って再試行してください");
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}

/** ルートから使う: 現在の env でレート制限を判定し、超過なら 429 を返す。 */
export async function enforceApiRateLimit(env: AppEnv): Promise<NextResponse | null> {
  const store = new D1RateLimitStore(getDb(env));
  return enforceRateLimit(store, await apiKeyId(env.API_KEY!));
}

/**
 * 認証なしエンドポイント用: クライアントIP単位でレート制限を判定し、超過なら 429 を返す。
 * 生のIPをD1に保存しないよう、APIキーと同じ方式（SHA-256）でハッシュ化して識別子にする。
 */
export async function enforceIpRateLimit(
  env: AppEnv,
  request: NextRequest,
): Promise<NextResponse | null> {
  // 本番(Cloudflare)では CF-Connecting-IP が必ず付く。ローカル等それ以外の環境では
  // X-Forwarded-For の先頭、どちらもなければ "unknown" にフォールバックする
  // （Next.js 15 では request.ip が廃止されているためヘッダーのみで判定する）。
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown";
  const store = new D1RateLimitStore(getDb(env));
  return enforceRateLimit(store, `ip:${await sha256Hex(ip)}`);
}
