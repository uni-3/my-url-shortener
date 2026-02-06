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

用途はリアルタイムモード

GCPのコンソールから、Safe Browsing API を有効にする
#### Monitoring (OpenTelemetry)

本番環境のトレースを Grafana Cloud に送信するための設定です。

##### Grafana Cloud の設定取得
1. Grafana Cloud の管理画面から OTLP エンドポイント情報を取得します。
2. **UserID** と **API Key** をメモします。

##### 環境変数の設定
`wrangler.toml` および Secret として以下の値を設定します：

- `GRAFANA_OTLP_ENDPOINT`: 取得した OTLP エンドポイント（例: `https://otlp-gateway-prod-us-central-0.grafana.net/otlp/v1/traces`）
- `GRAFANA_AUTH_TOKEN`: `Base64(UserID:APIKey)` 形式のトークン
  - 生成例: `echo -n "12345:glc_..." | base64`
  - 設定方法: `npx wrangler secret put GRAFANA_AUTH_TOKEN --env production`



