# チャット基盤の選定記録（ADR）: Cloudflare agents SDK + Gemini

- ステータス: 採用
- 日付: 2026-06-16

## 背景・文脈

「チャットで短縮」機能はもともと **ブラウザ側 Prompt API (Gemini Nano)** によるオンデバイス推論で実装していた
（`app/components/ChatInterface.tsx` + `lib/chat/mcp-bridge.ts`）。会話は React のメモリ上のみで、
ツール呼び出しは `/api/chat/mcp` の MCP サーバー（`shorten_url` / `resolve_url`）を利用していた。

ここで「Cloudflare agents SDK を実際に使ってチャットを構築したらどうなるか（楽になるか、過剰か）」を検討した。
本ドキュメントはその検討経緯と最終決定を残すものである。

## 検討した選択肢

### 1. cloudflare/agents の `examples/workflows`
並行ワークフロー + human-in-the-loop 承認ゲートのデモであり、**会話チャットではない**。
URL 短縮チャットには機能過剰なため不採用。

### 2. Vercel AI SDK（`useChat` + ステートレス `/api/chat`）
「履歴はメモリのみ・リロードで消える」要件に対しては Durable Object 不要で最小・最適。
ただし今回の目的が **「agents SDK を試す」** ことだったため、今回は見送り（将来の代替候補として記録）。

### 3. Cloudflare agents SDK の `AIChatAgent`（採用）
`onChatMessage` に処理が集約され、WebSocket ストリーミング・再接続復元が標準で得られる。
推論プロバイダ非依存で、`onChatMessage` 内で AI SDK の `streamText()` を任意のモデルで呼べる。

## 決定

**Cloudflare agents SDK の `AIChatAgent` + Gemini（サーバー経由）** を採用する。

- **推論**: `@ai-sdk/google` の Gemini（`gemini-2.5-flash`）。APIキーは secret（`GOOGLE_GENERATIVE_AI_API_KEY`）。
  Gemini は外部 HTTP API のため Cloudflare の `[ai]` バインディングは不要。
- **ユーザー体験の履歴**: メモリのみ・リロードで消える。フロントが **ページロード毎にランダムな
  session id**（`crypto.randomUUID()`、storage 非保存）を生成し、`useAgent({ name: sessionId })` の
  Durable Object 名に使う。リロード＝新しい DO＝空の履歴。
- **運用ログ**: 会話の保存目的は「後から見返す/分析できるログ」。DO 内蔵 SQLite は会話ごとに散在し
  横断クエリできないためログ用途に不向き。よって **既存の D1（`DB`）に `chat_logs` テーブルを追加**し、
  ターン完了時（`onChatMessage` の `onFinish`）に user/assistant を追記する。
  → **ライブ = DO / ログ = D1** に関心を分離。
- **Worker 構成**: デプロイ対象を増やさないため **opennextjs と同一 Worker に共存**。
  カスタムエントリ `worker.ts` を `wrangler.toml` の `main` にし、
  生成物 `.open-next/worker.js` の default ハンドラと内部 Durable Object を re-export、
  自前の `UrlChatAgent` を export、`fetch` 前段で `routeAgentRequest` を試して
  該当しなければ Next.js ハンドラへ委譲する。

## 主要ファイル

- `agent/url-chat-agent.ts` — `UrlChatAgent extends AIChatAgent`。Gemini 呼び出し、ツール、D1 ログ。
- `worker.ts` — 共存用カスタムエントリ（`routeAgentRequest` → opennextjs 委譲）。
- `types/open-next-worker.d.ts` — 生成 `.open-next/worker.js` のアンビエント宣言。
- `db/schema/chat-logs.ts` / `lib/core/chat-log-repository.ts` — D1 運用ログ。
- `app/components/ChatInterface.tsx` — `useAgent` + `useAgentChat`。
- ツールは `lib/core/shorten-service.ts`（`buildService`）と `lib/validations/url.ts` を再利用。

## トレードオフ / 注意点

- **検証で分かったこと**: agents SDK 系（`agents` / `@cloudflare/ai-chat`）は peer 依存で zod v4 を要求するが、
  本アプリは zod v3。実際に試したところ AI SDK v6 の `tool()` は zod v3 スキーマを受理し、
  **型エラーは出ず共存可能**だった（peer 警告は警告止まり）。
- **共存の脆さ**: `worker.ts` が re-export する opennextjs 内部 DO 名
  （`DOQueueHandler` / `DOShardedTagCache` / `BucketCachePurge`）は **opennextjs のバージョンに依存**する。
  アップグレード時は `.open-next/worker.js` の export と突き合わせること（CLAUDE.md の phantom dependency 教訓と同種のリスク）。
- DO の永続化（AIChatAgent 本来の主眼）は今回使っていない。永続セッションが必要になったら
  安定 session id + DO/D1 に切り替える。
- オンデバイス推論（Gemini Nano）の「無料・オフライン・プライバシー」は失い、サーバー側 Gemini の
  APIキー/課金/レイテンシが発生する。
- フォールバック方針: もし依存衝突がどうしても解決できない場合は Agent を別 Worker に分離する
  （今回は共存で解決できたため不要）。

## ローカル実行・検証

```bash
# 1. 依存
pnpm install

# 2. Gemini キー（ローカル）: .dev.vars に置く
echo 'GOOGLE_GENERATIVE_AI_API_KEY=...' >> .dev.vars

# 3. D1 マイグレーション（chat_logs 作成）
pnpm db:generate            # スキーマ変更時のみ
pnpm db:migrate:local

# 4. ビルド & プレビュー（共存 Worker）
pnpm exec opennextjs-cloudflare build
pnpm exec wrangler dev      # /agents/url-chat-agent/:name が解決される

# 5. 動作確認
#  - チャットで「https://example.com を短縮して」→ shorten_url 実行・履歴反映
#  - リロードで会話が消える（新しい session id で空の DO に接続）
#  - 会話後に chat_logs に user/assistant 行が入る:
pnpm db:conn:local 'SELECT * FROM chat_logs ORDER BY id DESC LIMIT 10;'
```

## デプロイ時

```bash
wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY --env production
pnpm db:migrate:production
pnpm deploy
```
