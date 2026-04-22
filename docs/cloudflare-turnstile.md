# Cloudflare Turnstile 調査メモ

## Turnstile とは

Cloudflare が提供するボット対策ウィジェット。従来の CAPTCHA（画像選択など）と異なり、**ユーザーに操作を求めることなく**バックグラウンドでブラウザの属性・行動パターンを評価してボット判定を行う。

### reCAPTCHA との主な違い

| 項目 | Turnstile | reCAPTCHA |
|---|---|---|
| ユーザー操作 | 基本不要（難易度が低い場合） | 画像選択などが発生することがある |
| Cookie / トラッキング | なし（GDPR フレンドリー） | Google のトラッキングあり |
| 無料枠 | 1サイトあたり月100万リクエストまで無料 | 無料 |
| 提供元 | Cloudflare | Google |

---

## セットアップ手順

### 1. ウィジェットの作成

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) → 左サイドバー「Turnstile」
2. 「Add widget」をクリック
3. ウィジェット名、許可するドメイン（例: `s.uni-3.app`）を入力
4. ウィジェットタイプを選択
   - **Managed**（推奨）: Cloudflare が難易度を自動判定
   - **Non-interactive**: 常時パス（チャレンジなし）
   - **Invisible**: ページ内に表示されない
5. 作成後、**Sitekey**（公開鍵）と **Secret key**（秘密鍵）を取得する

### 2. 鍵の使い分け

| 鍵 | 用途 | 公開可否 |
|---|---|---|
| **Sitekey** | フロントエンドのウィジェット描画 | 公開 OK（HTML に埋め込む） |
| **Secret key** | サーバーサイドでのトークン検証 | **絶対に非公開**（Workerシークレットに保管） |

---

## 開発用テストキー

本番ウィジェットを作成せずにローカル開発できるよう、Cloudflare が固定のテストキーを提供している。

### Sitekey（フロントエンド用）

| Sitekey | 動作 |
|---|---|
| `1x00000000000000000000AA` | 常時パス（自動、チャレンジなし） |
| `2x00000000000000000000AB` | 常時ブロック（エラー表示） |
| `3x00000000000000000000FF` | インタラクティブチャレンジを強制 |

### Secret key（サーバー検証用）

| Secret key | 動作 |
|---|---|
| `1x0000000000000000000000000000000AA` | 常時 `success: true` |
| `2x0000000000000000000000000000000AA` | 常時 `success: false` |

---

## クライアントサイドの実装

### パッケージ

公式推奨のコミュニティライブラリ `@marsidev/react-turnstile` を使用する。

```bash
npm install @marsidev/react-turnstile
```

### 基本的な使い方

```tsx
import { Turnstile } from "@marsidev/react-turnstile";

<Turnstile
  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
  onSuccess={(token) => setTurnstileToken(token)}
  onExpire={() => setTurnstileToken(null)}
  onError={() => setTurnstileToken(null)}
/>
```

### Ref でウィジェットを操作する

```tsx
import { useRef } from "react";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";

const ref = useRef<TurnstileInstance>(null);

// フォーム送信後にリセット
ref.current?.reset();
```

### トークンの特性

- **有効期限**: 生成から **5分** で失効
- **使い捨て**: 1回の検証にしか使えない（再利用すると `timeout-or-duplicate` エラー）
- **最大長**: 2048 文字

---

## サーバーサイド検証

### API エンドポイント

```
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
Content-Type: application/x-www-form-urlencoded
```

### リクエストパラメータ

| パラメータ | 必須 | 説明 |
|---|---|---|
| `secret` | ✅ | Secret key |
| `response` | ✅ | クライアントから受け取ったトークン |
| `remoteip` | ❌ | 検証の精度向上のため推奨（訪問者の IP） |
| `idempotency_key` | ❌ | 冪等性キー（リトライ時に重複防止） |

### レスポンス形式

**成功時**

```json
{
  "success": true,
  "challenge_ts": "2024-01-01T00:00:00.000Z",
  "hostname": "s.uni-3.app",
  "action": "",
  "cdata": "",
  "error-codes": []
}
```

**失敗時**

```json
{
  "success": false,
  "error-codes": ["invalid-input-response"]
}
```

### 主なエラーコード

| コード | 意味 |
|---|---|
| `missing-input-secret` | Secret key が未送信 |
| `invalid-input-secret` | Secret key が無効 |
| `missing-input-response` | トークンが未送信 |
| `invalid-input-response` | トークンが無効または期限切れ |
| `timeout-or-duplicate` | トークンが再使用された |
| `internal-error` | Cloudflare 側のエラー（リトライ推奨） |

---

## このプロジェクトでの設定方法

### 環境変数

| 変数名 | 用途 | 設定方法 |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | フロントエンド（ビルド時に埋め込まれる） | `.env.local` / `.dev.vars` |
| `TURNSTILE_SECRET_KEY` | サーバーサイド検証（Worker シークレット） | `wrangler secret put` |

### ローカル開発（`.env.local` または `.dev.vars`）

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### 本番シークレットの設定

```bash
wrangler secret put TURNSTILE_SECRET_KEY --env production
wrangler secret put TURNSTILE_SECRET_KEY --env development
```

> ⚠️ `NEXT_PUBLIC_TURNSTILE_SITE_KEY` はビルド時に JS バンドルに埋め込まれるため、`wrangler.toml` の `[vars]` に設定するか、CI/CD の環境変数として渡す。

---

## フロー全体像

```
ユーザーがフォームを開く
      ↓
Turnstile ウィジェットがロードされ、バックグラウンドで検証
      ↓
検証パス → onSuccess(token) でトークンを取得
      ↓
ユーザーがフォームを送信 → token を一緒に POST /api/shorten
      ↓
サーバー: Cloudflare Siteverify API にトークンを送信して検証
      ↓
success: true → URL 短縮処理を続行
success: false → 403 エラーを返す
```
