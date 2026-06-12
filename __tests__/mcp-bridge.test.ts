import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

const { MockClient, MockTransport, mockConnect } = vi.hoisted(() => {
  const mockConnect = vi.fn();
  return {
    mockConnect,
    MockClient: vi.fn(function (this: { connect: typeof mockConnect }) {
      this.connect = mockConnect;
    }),
    MockTransport: vi.fn(),
  };
});

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: MockClient,
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: MockTransport,
}));

import { createMcpClient, buildPromptApiTools } from "@/lib/chat/mcp-bridge";

/** listTools / callTool だけを持つ最小のクライアントスタブを作る。 */
function stubClient(overrides: { listTools?: unknown; callTool?: unknown } = {}) {
  return {
    listTools: vi.fn().mockResolvedValue(
      overrides.listTools ?? {
        tools: [
          {
            name: "shorten_url",
            description: "URLを短縮します",
            inputSchema: {
              $schema: "http://json-schema.org/draft-07/schema#",
              additionalProperties: false,
              type: "object",
              properties: { url: { type: "string", description: "短縮したいURL" } },
              required: ["url"],
            },
          },
        ],
      },
    ),
    callTool: vi.fn().mockResolvedValue(overrides.callTool ?? { content: [] }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe("createMcpClient", () => {
  it("connects a Client to /api/chat/mcp without auth", async () => {
    const client = await createMcpClient();
    expect(MockClient).toHaveBeenCalledWith({ name: "url-shortener-chat", version: "1.0.0" });
    expect(MockTransport).toHaveBeenCalledTimes(1);
    const url = MockTransport.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/api/chat/mcp");
    expect(url.origin).toBe(window.location.origin);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(client).toBeInstanceOf(MockClient);
  });
});

describe("buildPromptApiTools", () => {
  it("maps MCP tools to Prompt API tools and strips schema meta keys", async () => {
    const client = stubClient();
    const tools = await buildPromptApiTools(client as unknown as Client, vi.fn());

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("shorten_url");
    expect(tools[0].description).toBe("URLを短縮します");
    expect(tools[0].inputSchema).toEqual({
      type: "object",
      properties: { url: { type: "string", description: "短縮したいURL" } },
      required: ["url"],
    });
    expect(tools[0].inputSchema).not.toHaveProperty("$schema");
    expect(tools[0].inputSchema).not.toHaveProperty("additionalProperties");
  });

  it("joins text content items into a single string on execute", async () => {
    const client = stubClient({
      callTool: {
        content: [
          { type: "text", text: "1行目" },
          { type: "image", data: "..." },
          { type: "text", text: "2行目" },
        ],
      },
    });
    const tools = await buildPromptApiTools(client as unknown as Client, vi.fn());

    const result = await tools[0].execute({ url: "https://example.com" });
    expect(result).toBe("1行目\n2行目");
    expect(client.callTool).toHaveBeenCalledWith({
      name: "shorten_url",
      arguments: { url: "https://example.com" },
    });
  });

  it("prefixes the result with エラー: when the tool returns isError", async () => {
    const client = stubClient({
      callTool: {
        isError: true,
        content: [{ type: "text", text: "指定された短縮コードは存在しません" }],
      },
    });
    const tools = await buildPromptApiTools(client as unknown as Client, vi.fn());

    const result = await tools[0].execute({ url: "https://example.com" });
    expect(result).toBe("エラー: 指定された短縮コードは存在しません");
  });

  it("returns a Japanese rate-limit message instead of throwing on a 429 transport error", async () => {
    const client = stubClient();
    client.callTool.mockRejectedValue(new Error("Error POSTing to endpoint (HTTP 429)"));
    const onToolResult = vi.fn();
    const tools = await buildPromptApiTools(client as unknown as Client, onToolResult);

    const result = await tools[0].execute({ url: "https://example.com" });
    expect(result).toBe("リクエストが多すぎます。しばらく待ってから再試行してください");
    expect(onToolResult).toHaveBeenCalledWith({
      toolName: "shorten_url",
      args: { url: "https://example.com" },
      resultText: "リクエストが多すぎます。しばらく待ってから再試行してください",
      isError: true,
    });
  });

  it("returns a Japanese error message instead of throwing on other transport errors", async () => {
    const client = stubClient();
    client.callTool.mockRejectedValue(new Error("fetch failed"));
    const tools = await buildPromptApiTools(client as unknown as Client, vi.fn());

    const result = await tools[0].execute({ url: "https://example.com" });
    expect(result).toBe("ツールの呼び出しに失敗しました: fetch failed");
  });

  it("invokes onToolResult with a JSON-parsable payload for a successful shorten_url call", async () => {
    const payload = {
      code: "abc123",
      short_url: "https://sho.rt/abc123",
      long_url: "https://example.com/",
      isExisting: false,
    };
    const client = stubClient({
      callTool: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] },
    });
    const onToolResult = vi.fn();
    const tools = await buildPromptApiTools(client as unknown as Client, onToolResult);

    await tools[0].execute({ url: "https://example.com" });

    expect(onToolResult).toHaveBeenCalledTimes(1);
    const event = onToolResult.mock.calls[0][0];
    expect(event.toolName).toBe("shorten_url");
    expect(event.args).toEqual({ url: "https://example.com" });
    expect(event.isError).toBe(false);
    expect(JSON.parse(event.resultText)).toEqual(payload);
  });
});
