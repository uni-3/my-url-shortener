# URL短縮サービス

長いURLを短い文字列に変換し、安全かつスケーラブルなリダイレクト機能を提供するURL短縮サービスです。Cloudflare D1とKVを活用したエッジコンピューティング環境で動作します。

## 🚀 技術スタック

| カテゴリ | 選定技術 |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| ORM | Drizzle ORM |
| ID Generation | Sqids |
| Security API | Google Safe Browsing API |
| Validation | Zod |
| Styling | Tailwind CSS v4 |
| Infrastructure | Cloudflare Workers / Pages |
| Deployment | Wrangler |

## 📋 機能一覧

- **URL短縮**: Sqidsを使用した短い文字列への変換
- **リダイレクト**: 302一時リダイレクトによるクリック計測対応
- **キャッシュ**: Cloudflare KVによる低レイテンシなリダイレクト
- **セキュリティ**: Google Safe Browsing APIによる危険サイトチェック
- **バリデーション**: ZodによるURL形式チェックと重複登録防止
- **モニタリング**: OpenTelemetryによる実行時トレースの可視化

## 🛠️ セットアップ

### 前提条件
- Node.js 18+
- pnpm 10+
- Cloudflare アカウント（デプロイする場合）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/uni-3/my-url-shortener.git
cd my-url-shortener

# 依存関係をインストール
pnpm install

# 環境変数を設定
cp .env.example .env.local
```

### ローカル開発環境のセットアップ

Cloudflare D1とKVをローカルでシミュレートするために以下の手順を実行します。

```bash
# ローカルD1データベースにマイグレーションを適用
pnpm db:migrate:local

# 開発サーバーを起動（CloudflareのBindingを有効化）
pnpm dev:cf
```

ブラウザで `http://localhost:3000` にアクセスしてください。

### ビルドとデプロイ

```bash
# ビルド
pnpm build

# Cloudflareにデプロイ
pnpm wrangler pages deploy .next
```

## 📁 プロジェクト構成

```
├── app/                    # Next.js App Router (UI & API Route)
├── db/                     # データベース関連
│   ├── schema/            # テーブル定義
│   └── index.ts           # D1 クライアント
├── migrations/             # D1 マイグレーションファイル (SQL)
├── drizzle/                # Drizzle ORM の設定・メタデータ
├── lib/                    # ユーティリティ・外部API連携
│   ├── api/               # Google Safe Browsing等
│   ├── utils/             # Sqids等
│   └── validations/       # Zodスキーマ
├── terraform/              # インフラ定義 (Terraform)
├── wrangler.toml           # Cloudflare 設定
├── package.json            # 依存関係・スクリプト
└── tsconfig.json           # TypeScript 設定
```

## 🔐 セキュリティチェックのフロー

URL登録時の処理順序：

1. **バリデーション**: ZodでURL形式を確認
2. **重複チェック**: 既存URLの場合は既存の短縮コードを返す
3. **セキュリティ審査**: Google Safe Browsing APIで危険判定
4. **DB保存**: 安全なら短縮コードを生成して保存（トランザクション処理）
5. **キャッシュ更新**: Cloudflare KVに保存

## 📝 開発ガイドライン

### データベース操作

```bash
# スキーマ変更後にマイグレーションファイルを生成
pnpm db:generate

# 生成されたSQLをmigrationsディレクトリにコピー（必要に応じて）
cp drizzle/*.sql migrations/

# ローカル環境に反映
pnpm db:migrate:local
```

### テスト実行

```bash
# ユニットテストを実行
pnpm test
```

## 📊 モニタリング (OpenTelemetry)

本プロジェクトは OpenTelemetry を導入しており、以下の挙動になります：

- **開発環境**: トレース情報はコンソール（標準出力）に書き出されます。
- **本番環境**: Grafana Cloud などの OTLP 対応プラットフォームに直接トレースをエクスポートします。

### Grafana Cloud へのエクスポート設定

詳細な設定手順（環境変数や認証情報の取得方法など）については、[docs/SETUP.md](file:///Users/todate.yuni/p_dev/my-url-shortener/docs/SETUP.md) を参照してください。

## 🤝 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずIssueを開いて変更内容を説明してください。

## 📄 ライセンス

MIT
