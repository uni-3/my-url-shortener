# URL短縮サービス

長いURLを短い文字列に変換し、安全かつスケーラブルなリダイレクト機能を提供するURL短縮サービスです。

## 🚀 技術スタック

| カテゴリ | 選定技術 |
|---|---|
| Framework | Next.js (App Router) + Express |
| Language | TypeScript |
| Database | Vercel Postgres |
| ORM | Drizzle ORM |
| ID Generation | Sqids |
| Security API | Google Safe Browsing API |
| Validation | Zod |
| Styling | Tailwind CSS v4 |
| Infrastructure | Cloudflare Workers |
| Deployment | Wrangler |

## 📋 機能一覧

- **URL短縮**: Sqidsを使用した短い文字列への変換
- **リダイレクト**: 302一時リダイレクトによるクリック計測対応
- **セキュリティ**: Google Safe Browsing APIによる危険サイトチェック
- **バリデーション**: ZodによるURL形式チェックと重複登録防止
- **スケーラビリティ**: シングルサーバー構成に最適化

## 🛠️ セットアップ

### 前提条件
- Node.js 18+
- pnpm 10+
- Cloudflare アカウント

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

### 開発サーバーの起動

```bash
# 開発環境で実行
pnpm dev

# ブラウザで http://localhost:3000 にアクセス
```

### ビルドとデプロイ

```bash
# ビルド
pnpm build

# Cloudflare Workersにデプロイ（開発環境）
pnpm wrangler deploy --env development

# Cloudflare Workersにデプロイ（本番環境）
pnpm wrangler deploy --env production
```

## 📁 プロジェクト構成

```
├── client/                 # フロントエンド (React + Vite)
│   ├── src/
│   │   ├── pages/         # ページコンポーネント
│   │   ├── components/    # 再利用可能なコンポーネント
│   │   ├── App.tsx        # ルーティング定義
│   │   └── main.tsx       # エントリーポイント
│   └── public/            # 静的アセット
├── server/                # バックエンド (Express + tRPC)
│   ├── routers.ts         # tRPC ルーター定義
│   ├── db.ts              # データベースクエリ
│   └── _core/             # フレームワークコア
├── drizzle/               # データベーススキーマ
│   └── schema.ts          # テーブル定義
├── shared/                # 共有ユーティリティ
├── wrangler.toml          # Cloudflare Workers設定
├── vite.config.ts         # Vite設定
├── tailwind.config.ts     # Tailwind CSS設定
└── tsconfig.json          # TypeScript設定
```

## 🔐 セキュリティチェックのフロー

URL登録時の処理順序：

1. **バリデーション**: ZodでURL形式を確認
2. **重複チェック**: 既存URLの場合は既存IDを返す
3. **セキュリティ審査**: Google Safe Browsing APIで危険判定
4. **DB保存**: 安全なら短縮コードを生成して保存

## 📝 開発ガイドライン

### データベース操作

```bash
# スキーマ変更後にマイグレーション
pnpm db:push
```

### テスト実行

```bash
# ユニットテストを実行
pnpm test
```

### コードフォーマット

```bash
# Prettierでフォーマット
pnpm format
```

## 🤝 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずIssueを開いて変更内容を説明してください。

## 📄 ライセンス

MIT
