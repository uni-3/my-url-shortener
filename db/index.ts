import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/urls";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

export interface AppEnv {
  DB: D1Database;
  URL_CACHE?: KVNamespace;
  GOOGLE_SAFE_BROWSING_API_KEY?: string;
  IP_SALT?: string;
  ENVIRONMENT?: "development" | "production";
}

/**
 * リクエストコンテキストからD1データベースクライアントを取得する
 * D1バインディングはリクエスト時にのみ利用可能なため、
 * モジュールトップレベルではなく関数内で初期化する必要がある
 */
export function getDb(env: AppEnv): DbClient {
  return drizzle(env.DB, { schema });
}
