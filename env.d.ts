import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

declare module "@opennextjs/cloudflare" {
  interface CloudflareEnv {
    DB: D1Database;
    URL_CACHE: KVNamespace;
    GOOGLE_SAFE_BROWSING_API_KEY?: string;
    IP_SALT?: string;
    ENVIRONMENT?: "development" | "production";
  }
}
