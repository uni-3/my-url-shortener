# my-url-shortener

Cloudflare Workers (opennextjs-cloudflare) にデプロイするNext.js製のURL短縮サービス。

## 技術スタック

- **ランタイム**: Cloudflare Workers (V8 isolate, Node.jsではない)
- **フレームワーク**: Next.js 15 + opennextjs-cloudflare
- **DB**: Cloudflare D1 (SQLite)
- **キャッシュ**: Cloudflare KV
- **可観測性**: OpenTelemetry → Grafana Cloud (Tempo)

## OpenTelemetry

### 注意事項

Cloudflare Workers はNode.js互換ではなくV8 isolate環境のため、以下のパッケージは使用不可：
- `@vercel/otel` — Node.js専用、`instrumentation.ts` のロードに失敗する
- `BasicTracerProvider.addSpanProcessor()` — v2.xで廃止
- `BasicTracerProvider.register()` — v2.xで廃止
- `new Resource()` — `@opentelemetry/resources` v2.xで廃止

### 現在の実装 (`instrumentation.ts`)

`@opentelemetry/sdk-trace-base` v2.x の正しいAPI：
- **Resource**: `resourceFromAttributes()` を使用
- **SpanProcessor**: コンストラクタの `spanProcessors: []` で渡す
- **グローバル登録**: `trace.setGlobalTracerProvider(provider)` を使用

### OTel変更時の確認手順

1. **ローカルビルド確認** — デプロイ前に必ず手元でビルドが通るか確認する：
   ```bash
   pnpm build
   ```

2. **デプロイ後のランタイム確認** — `wrangler tail` でOTelが正常初期化されているか確認：
   ```bash
   wrangler tail my-url-shortener --env production --format pretty
   ```
   リクエストを送って以下がないことを確認：
   - `Failed to prepare server Error: An error occurred while loading the instrumentation hook`

3. **Grafana Cloud確認** — Explore → Tempo でサービス名 `my-url-shortener` のtraceを検索

### console.logの見方

本番の `console.log` はVercelではなく **Cloudflare Workers Logs** に出力される。
`wrangler tail` または Cloudflare Dashboard → Workers → Logs で確認。
