# URL短縮サービス - プロジェクト TODO

## Issue #6: プロジェクト初期化とデプロイ設定
- [x] Next.js プロジェクトの初期化
- [ ] Cloudflare Workers (Wrangler) の設定ファイル作成
- [ ] Tailwind CSS v4 のスタイリング基盤整備
- [ ] 基本的なルーティング構造の確立
- [ ] 開発環境とプロダクション環境の設定分離

## Issue #7: Vercel Postgres と Drizzle ORM のセットアップ
- [x] @vercel/postgres と drizzle-orm のインストール
- [x] urls テーブルのスキーマ定義 (id, long_url, short_code, created_at)
- [x] マイグレーションスクリプトの設定

## Issue #8: Zod による URL バリデーションの実装
- [x] Zod スキーマの定義
- [x] URL形式チェック関数の作成
- [x] ユニットテストの追加

## Issue #9: Sqids による短縮コード生成ロジックの実装
- [x] sqids ライブラリの導入
- [x] ID ↔ Code 変換ユーティリティの作成
- [x] ユニットテストの追加

## Issue #10: URL登録 API の作成 (基本機能)
- [x] POST /api/shorten エンドポイントの作成
- [x] 同一URLの重複チェックロジック
- [x] DB保存と短縮コード発行の連携

## Issue #11: Google Safe Browsing API による安全確認の実装
- [x] API クライアントの実装
- [x] 登録フローへの組み込み
- [x] 危険判定時のエラーレスポンス処理

## Issue #12: 302 リダイレクト機能の実装
- [x] ダイナミックルーティング ([code]) の作成
- [x] DBからのURL検索ロジック
- [x] 302 Redirect の実行

## Issue #13: URL短縮フォームの UI 実装
- [ ] 入力フォームの作成
- [ ] API 呼び出しと結果表示 (コピー機能など)
- [ ] エラー表示のハンドリング
