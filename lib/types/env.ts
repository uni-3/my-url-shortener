export interface Env {
  DB: D1Database;
  URL_CACHE: KVNamespace;
  GOOGLE_SAFE_BROWSING_API_KEY?: string;
  IP_SALT?: string;
  ENVIRONMENT: "development" | "production";
}
