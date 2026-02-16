deployまでに必要な値の設定

#### cloudflare

##### token

トークンの作成コンソール画面のアカウント API トークンより

- terraform apply用トークン、D1, R2, ログ, KVの編集権限をもたせる

(terraform applyあと)

- envに設定するD1トークン、D1の編集権限

- deploy用トークン

```
Workers スクリプト - 編集
D1 - 編集
Workers KV ストレージ - 編集
ゾーン Workers ルート - 編集
ゾーン DNS - 閲覧
```

デプロイコマンド

```
export CLOUDFLARE_API_TOKEN=xxx

pnpm run deploy
```

#### terraform

state管理用backend.hclの作成

```sh
cp terraform/backend.hcl.example terraform/backent.hcl
```

variablesの作成

```sh
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

apply後に、.envに必要なIDなどをメモ

#### google safe browsing api

https://developers.google.com/safe-browsing/reference?hl=ja

用途はリアルタイムモード。GCPのコンソールから、Safe Browsing API を有効にしてAPIキーを取得してください。

### 環境変数の設定

本プロジェクトでは、セキュリティのために機密情報を `wrangler.toml` に直接記述せず、Cloudflare Workers の Secret または環境変数ファイル（`.env.local`, `.dev.vars`）を使用して管理します。

#### 設定が必要な変数一覧

| 変数名 | 説明 | 必須 | 備考 |
|---|---|---|---|
| `IP_SALT` | IPアドレスのハッシュ化用ソルト | はい | プライバシー保護のため。任意のランダム文字列。 |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Google Safe Browsing API キー | いいえ | 指定しない場合、安全確認をスキップします。 |
| `GRAFANA_AUTH_TOKEN` | Grafana Cloud 認証トークン | はい | `Base64(UserID:APIKey)` 形式。 |
| `GRAFANA_OTLP_ENDPOINT` | Grafana OTLP エンドポイント | いいえ | トレース送信先 URL。 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID | はい | デプロイや D1 操作に使用。 |
| `CLOUDFLARE_DATABASE_ID` | Cloudflare D1 データベース ID | はい | デプロイや D1 操作に使用。 |
| `CLOUDFLARE_D1_TOKEN` | Cloudflare API トークン | はい | D1 操作に使用。 |

#### 本番環境の設定 (Cloudflare Workers Secret)

本番環境では、以下のコマンドを使用して機密情報を Secret として設定してください：

```bash
# IP_SALT の設定 (推奨: openssl rand -hex 32 等で生成)
npx wrangler secret put IP_SALT --env production

# Google Safe Browsing API キーの設定
npx wrangler secret put GOOGLE_SAFE_BROWSING_API_KEY --env production

# Grafana 認証トークンの設定
npx wrangler secret put GRAFANA_AUTH_TOKEN --env production
```

#### ローカル開発環境の設定

ローカル開発では、使用するツールに応じて以下のファイルに設定を記述します。

##### 1. `next dev` (pnpm dev) を使用する場合
`.env.local` ファイルをプロジェクトルートに作成します：

```env
IP_SALT=development-salt
GOOGLE_SAFE_BROWSING_API_KEY=your-api-key
```

##### 2. `wrangler dev` を使用する場合
`.dev.vars` ファイルをプロジェクトルートに作成します：

```env
IP_SALT=development-salt
GOOGLE_SAFE_BROWSING_API_KEY=your-api-key
```

#### Monitoring (OpenTelemetry) の詳細

本番環境のトレースを Grafana Cloud に送信するための設定手順です。

##### Grafana Cloud の設定取得
1. Grafana Cloud の管理画面から OTLP エンドポイント情報を取得します。
2. **UserID** と **API Key** をメモします。
3. `Base64(UserID:APIKey)` を生成します（例: `echo -n "12345:glc_..." | base64`）。



