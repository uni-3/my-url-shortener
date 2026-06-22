import { parseArgs } from "node:util";
import { ApiError, createLink, deleteLink, getLink, type ClientConfig } from "./client";

const USAGE = `URL短縮CLI — v1 API クライアント

使い方:
  pnpm cli <command> [argument] [options]

コマンド:
  shorten <url>     URL を短縮して短縮 URL を出力する
  get <code>        短縮コードから登録情報を取得する
  delete <code>     短縮リンクを削除する

オプション:
  --base-url <url>  API のベース URL (既定: 環境変数 API_BASE_URL)
  --key <key>       API キー (既定: 環境変数 API_KEY)
  -h, --help        このヘルプを表示する`;

type Command = (config: ClientConfig, target: string | undefined) => Promise<number>;

function missingArgument(usage: string): number {
  console.error(`引数が不足しています。使い方: ${usage}`);
  return 2;
}

const COMMANDS: Record<string, Command> = {
  async shorten(config, target) {
    if (!target) return missingArgument("shorten <url>");
    const link = await createLink(config, target);
    console.log(link.short_url);
    return 0;
  },
  async get(config, target) {
    if (!target) return missingArgument("get <code>");
    const link = await getLink(config, target);
    console.log(`${link.code}\t${link.long_url}`);
    return 0;
  },
  async delete(config, target) {
    if (!target) return missingArgument("delete <code>");
    await deleteLink(config, target);
    console.log(`削除しました: ${target}`);
    return 0;
  },
};

/** argv を解釈してコマンドを実行し、プロセスの終了コードを返す。 */
export async function run(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        "base-url": { type: "string" },
        key: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    console.log(USAGE);
    return 0;
  }

  const [name, target] = positionals;
  if (!name) {
    console.error(USAGE);
    return 2;
  }

  const command = COMMANDS[name];
  if (!command) {
    console.error(`不明なコマンド: ${name}`);
    console.error(USAGE);
    return 2;
  }

  const baseUrl = values["base-url"] ?? process.env.API_BASE_URL;
  const apiKey = values.key ?? process.env.API_KEY;
  if (!baseUrl || !apiKey) {
    console.error(
      "API のベース URL と API キーが必要です。環境変数 API_BASE_URL / API_KEY か --base-url / --key で指定してください",
    );
    return 2;
  }

  try {
    return await command({ baseUrl, apiKey }, target);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`エラー (HTTP ${error.status}): ${error.message}`);
    } else {
      console.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
    return 1;
  }
}
