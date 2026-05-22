#!/usr/bin/env tsx
/**
 * URL短縮CLIスクリプト
 *
 * 使い方:
 *   pnpm shorten <URL>                   # ローカルD1
 *   pnpm shorten <URL> --env production  # 本番D1
 *
 * 必須: wrangler がインストールされていること
 */

import { execSync } from "child_process";
import { normalizeUrl } from "../lib/utils/url";
import { encodeId } from "../lib/utils/sqids";

const DB_NAME: Record<string, string> = {
  development: "url-shortener-development",
  production: "url-shortener-production",
};

const BASE_URL: Record<string, string> = {
  development: "https://dev-s.uni-3.app",
  production: "https://s.uni-3.app",
};

function parseArgs(args: string[]) {
  const url = args.find((a) => !a.startsWith("--"));
  const envIdx = args.indexOf("--env");
  const env = envIdx !== -1 && args[envIdx + 1] ? args[envIdx + 1] : "development";
  return { url, env };
}

function d1(dbName: string, remote: boolean, sql: string) {
  const remoteFlag = remote ? "--remote" : "--local";
  const cmd = `wrangler d1 execute ${dbName} ${remoteFlag} --json --command ${JSON.stringify(sql)}`;
  const out = execSync(cmd, { encoding: "utf-8" });
  const parsed = JSON.parse(out) as Array<{ results: unknown[] }>;
  return parsed[0]?.results ?? [];
}

async function main() {
  const args = process.argv.slice(2);
  const { url, env } = parseArgs(args);

  if (!url) {
    console.error("使い方: pnpm shorten <URL> [--env development|production]");
    process.exit(1);
  }

  try {
    new URL(url);
  } catch {
    console.error("エラー: 有効なURLを入力してください");
    process.exit(1);
  }

  const dbName = DB_NAME[env];
  if (!dbName) {
    console.error(`エラー: 不明な env: ${env}`);
    process.exit(1);
  }

  const remote = env === "production";
  const normalized = normalizeUrl(url);
  const escaped = normalized.replace(/'/g, "''");

  // 既存URLのチェック
  const existing = d1(
    dbName,
    remote,
    `SELECT id, short_code FROM urls WHERE long_url = '${escaped}' LIMIT 1`
  ) as Array<{ id: number; short_code: string }>;

  if (existing.length > 0) {
    console.log(`${BASE_URL[env]}/${existing[0].short_code}`);
    return;
  }

  // 挿入してIDを取得し、sqidsでエンコード
  const tmpCode = `tmp-${Date.now()}`;
  const inserted = d1(
    dbName,
    remote,
    `INSERT INTO urls (long_url, short_code) VALUES ('${escaped}', '${tmpCode}') RETURNING id`
  ) as Array<{ id: number }>;

  if (inserted.length === 0) {
    console.error("エラー: DBへの挿入に失敗しました");
    process.exit(1);
  }

  const shortCode = encodeId(inserted[0].id);
  d1(dbName, remote, `UPDATE urls SET short_code = '${shortCode}' WHERE id = ${inserted[0].id}`);

  console.log(`${BASE_URL[env]}/${shortCode}`);
}

main().catch((err) => {
  console.error("エラー:", (err as Error).message);
  process.exit(1);
});
