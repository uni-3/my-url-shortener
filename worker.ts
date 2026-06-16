/**
 * カスタム Worker エントリ（opennextjs と Agent の共存）。
 *
 * `wrangler.toml` の `main` をこのファイルに向ける。`opennextjs-cloudflare build` が
 * 生成する `.open-next/worker.js` を取り込み、
 *  - リクエストはまず `routeAgentRequest` で Agent (Durable Object) にルーティングを試み、
 *  - 該当しなければ opennextjs の Next.js ハンドラに委譲する。
 *
 * opennextjs 内部の Durable Object と自前の `UrlChatAgent` を re-export し、
 * wrangler のバインディングが解決できるようにする。
 */
import { routeAgentRequest } from "agents";
import openNextHandler from "./.open-next/worker.js";
import { UrlChatAgent } from "./agent/url-chat-agent";

// opennextjs 内部の Durable Object（キャッシュ/キュー）を素通しで re-export する。
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
// 自前の Chat Agent（Durable Object）。
export { UrlChatAgent };

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }
    return openNextHandler.fetch(request, env, ctx);
  },
};
