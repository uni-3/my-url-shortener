/**
 * `.open-next/worker.js` は `opennextjs-cloudflare build` がビルド時に生成するため、
 * 型チェック時には存在しない。カスタムエントリ (`worker.ts`) から default ハンドラと
 * opennextjs 内部の Durable Object を re-export するための最小宣言を与える。
 *
 * 注意: 内部DO (`DOQueueHandler` 等) の export 名は opennextjs のバージョンに依存する。
 * アップグレード時は `.open-next/worker.js` の export と突き合わせて確認すること。
 */
declare module "*/.open-next/worker.js" {
  const handler: {
    fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response>;
  };
  export default handler;
  export const DOQueueHandler: unknown;
  export const DOShardedTagCache: unknown;
  export const BucketCachePurge: unknown;
}
