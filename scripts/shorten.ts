#!/usr/bin/env tsx
/**
 * URL短縮CLIスクリプト
 *
 * 使い方:
 *   pnpm shorten <URL>                        # ローカルD1
 *   pnpm shorten <URL> --env production       # 本番D1 (--remote)
 *
 * 必須: wrangler がインストールされていること
 */

import { execSync } from "child_process";
import Sqids from "sqids";

const sqids = new Sqids({ minLength: 6 });

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

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.pathname.endsWith("/index.html")) {
      u.pathname = u.pathname.slice(0, -10);
    }
    const lastSegment = u.pathname.split("/").pop() ?? "";
    if (!u.pathname.endsWith("/") && !lastSegment.includes(".")) {
      u.pathname += "/";
    }
    return u.href;
  } catch {
    return url;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const { url, env } = parseArgs(args);

  if (!url) {
    console.error("使い方: pnpm shorten <URL> [--env development|production]");
    process.exit(1);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.error("エラー: 有効なURLを入力してください");
    process.exit(1);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    console.error("エラー: https:// または http:// から始まるURLを入力してください");
    process.exit(1);
  }

  const dbName = DB_NAME[env];
  if (!dbName) {
    console.error(`エラー: 不明な env: ${env}`);
    process.exit(1);
  }

  const remote = env === "production";
  const normalized = normalizeUrl(url);

  // 既存URLのチェック
  const existing = d1(
    dbName,
    remote,
    `SELECT id, short_code FROM urls WHERE long_url = '${normalized.replace(/'/g, "''")}' LIMIT 1`
  ) as Array<{ id: number; short_code: string }>;

  if (existing.length > 0) {
    const shortUrl = `${BASE_URL[env]}/${existing[0].short_code}`;
    console.log(shortUrl);
    return;
  }

  // 一時コードで挿入してIDを取得
  const tmpCode = `tmp-${Date.now()}`;
  const inserted = d1(
    dbName,
    remote,
    `INSERT INTO urls (long_url, short_code) VALUES ('${normalized.replace(/'/g, "''")}', '${tmpCode}') RETURNING id`
  ) as Array<{ id: number }>;

  if (inserted.length === 0) {
    console.error("エラー: DBへの挿入に失敗しました");
    process.exit(1);
  }

  const id = inserted[0].id;
  const shortCode = sqids.encode([id]);

  // 実際の短縮コードで更新
  d1(dbName, remote, `UPDATE urls SET short_code = '${shortCode}' WHERE id = ${id}`);

  const shortUrl = `${BASE_URL[env]}/${shortCode}`;
  console.log(shortUrl);
}

main().catch((err) => {
  console.error("エラー:", (err as Error).message);
  process.exit(1);
});
