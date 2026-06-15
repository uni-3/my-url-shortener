import { v1App } from "@/lib/api/v1/app";

// /api/v1/* は Hono (@hono/zod-openapi) アプリに委譲する。
// opennextjs-cloudflare が Next.js 本体と同じ単一の Worker にバンドルするため、
// デプロイ先は1つのまま。
function handler(request: Request) {
  return v1App.fetch(request);
}

export { handler as GET, handler as POST, handler as DELETE };
