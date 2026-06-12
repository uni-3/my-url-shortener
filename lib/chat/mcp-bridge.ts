import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Prompt API (Gemini Nano) と自前のMCPサーバーをつなぐブラウザ側ブリッジ。
 * Reactに依存しない純粋ロジックとして切り出し、単体テスト可能にしている。
 */

/** ツール呼び出し結果の通知。UIがツールバブル表示や履歴登録に使う。 */
export interface ToolResultEvent {
  toolName: string;
  args: Record<string, unknown>;
  resultText: string;
  isError: boolean;
}

/** チャットUI用の認証なしMCPプロキシ (/api/chat/mcp) に接続したクライアントを返す。 */
export async function createMcpClient(): Promise<Client> {
  const client = new Client({ name: "url-shortener-chat", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL("/api/chat/mcp", window.location.origin),
  );
  await client.connect(transport);
  return client;
}

/**
 * MCPのinputSchemaをPrompt APIが受け付ける形に整える。
 * メタキー（$schema / additionalProperties）はGemini Nano側で解釈されず
 * エラーの原因になり得るため取り除く（type / properties / required / description は残す）。
 */
function sanitizeInputSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _schema, additionalProperties: _additional, ...rest } = schema;
  return rest;
}

/** MCPツール呼び出しの content からテキスト部分だけを結合して取り出す。 */
function joinTextContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (item): item is { type: "text"; text: string } =>
        typeof item === "object" &&
        item !== null &&
        (item as { type?: unknown }).type === "text" &&
        typeof (item as { text?: unknown }).text === "string",
    )
    .map((item) => item.text)
    .join("\n");
}

/** 通信エラーをモデルに伝えられる日本語メッセージへ変換する（throwしない方針）。 */
function describeTransportError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("429")) {
    return "リクエストが多すぎます。しばらく待ってから再試行してください";
  }
  return `ツールの呼び出しに失敗しました: ${message}`;
}

/**
 * MCPサーバーのツール一覧を取得し、Prompt APIの tools オプションに渡せる形へ変換する。
 * 各ツールの実行は MCP の tools/call にプロキシし、結果のテキストを返す。
 * エラー時もthrowせず日本語のエラーメッセージ文字列を返すことで、モデルが
 * そのままユーザーへ伝えられるようにする。
 */
export async function buildPromptApiTools(
  client: Client,
  onToolResult: (event: ToolResultEvent) => void,
): Promise<LanguageModelTool[]> {
  const { tools } = await client.listTools();
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: sanitizeInputSchema(tool.inputSchema as Record<string, unknown>),
    async execute(args: Record<string, unknown>): Promise<string> {
      let resultText: string;
      let isError: boolean;
      try {
        const result = await client.callTool({ name: tool.name, arguments: args });
        isError = result.isError === true;
        const text = joinTextContent(result.content);
        resultText = isError ? `エラー: ${text}` : text;
      } catch (error) {
        isError = true;
        resultText = describeTransportError(error);
      }
      onToolResult({ toolName: tool.name, args, resultText, isError });
      return resultText;
    },
  }));
}
