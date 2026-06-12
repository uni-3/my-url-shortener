// @vitest-environment node
// mcp-handler は node:http / node:net 等のビルトインを使うため、jsdomではなくnode環境で実行する。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { UrlRecord } from "@/lib/core/repository";

const { mockService, mockEnforceIpRateLimit } = vi.hoisted(() => ({
  mockService: { create: vi.fn(), get: vi.fn(), delete: vi.fn() },
  mockEnforceIpRateLimit: vi.fn(),
}));

vi.mock("@/lib/core/build", () => ({
  buildService: () => mockService,
}));

vi.mock("@/lib/api/rate-limit", () => ({
  enforceIpRateLimit: mockEnforceIpRateLimit,
}));

import { POST, GET, DELETE } from "@/app/api/chat/mcp/route";

const record: UrlRecord = {
  id: 1,
  longUrl: "https://example.com/",
  shortCode: "abc123",
  createdAt: "2026-05-22",
};

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: {
    tools?: Array<{ name: string; description?: string }>;
    content?: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

/** 認証ヘッダなしのMCPリクエストを組み立てる（チャットUIからの呼び出しを模す）。 */
function mcpRequest(body: unknown) {
  return new NextRequest("https://sho.rt/api/chat/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

/** Streamable HTTPのレスポンス(JSONまたはSSE)からJSON-RPCメッセージを取り出す。 */
async function readJsonRpc(res: Response): Promise<JsonRpcResponse> {
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (!dataLine) throw new Error(`No SSE data in response: ${text}`);
    return JSON.parse(dataLine.slice(6)) as JsonRpcResponse;
  }
  return JSON.parse(text) as JsonRpcResponse;
}

function toolsListBody(id = 1) {
  return { jsonrpc: "2.0", id, method: "tools/list", params: {} };
}

function toolsCallBody(name: string, args: Record<string, unknown>, id = 2) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEnforceIpRateLimit.mockResolvedValue(null);
});

describe("POST /api/chat/mcp rate limiting", () => {
  it("returns the 429 response when the IP rate limiter rejects the request", async () => {
    mockEnforceIpRateLimit.mockResolvedValue(new NextResponse(null, { status: 429 }));
    const res = await POST(mcpRequest(toolsListBody()));
    expect(res.status).toBe(429);
  });

  it("passes env and the request to the IP rate limiter", async () => {
    const request = mcpRequest(toolsListBody());
    await POST(request);
    expect(mockEnforceIpRateLimit).toHaveBeenCalledWith(expect.anything(), request);
  });
});

describe("POST /api/chat/mcp tools/list (no auth header)", () => {
  it("lists the shorten_url and resolve_url tools without authentication", async () => {
    const res = await POST(mcpRequest(toolsListBody()));
    expect(res.status).toBe(200);
    const message = await readJsonRpc(res);
    const names = message.result?.tools?.map((tool) => tool.name);
    expect(names).toContain("shorten_url");
    expect(names).toContain("resolve_url");
    expect(names).toHaveLength(2);
  });
});

describe("POST /api/chat/mcp tools/call (no auth header)", () => {
  it("shortens a URL via shorten_url", async () => {
    mockService.create.mockResolvedValue({ record, isExisting: false });
    const res = await POST(
      mcpRequest(toolsCallBody("shorten_url", { url: "https://example.com" })),
    );
    expect(res.status).toBe(200);
    const message = await readJsonRpc(res);
    expect(message.result?.isError).toBeFalsy();
    const payload = JSON.parse(message.result!.content![0].text) as Record<string, unknown>;
    expect(payload).toEqual({
      code: "abc123",
      short_url: "https://sho.rt/abc123",
      long_url: "https://example.com/",
      isExisting: false,
    });
  });

  it("resolves a code via resolve_url", async () => {
    mockService.get.mockResolvedValue(record);
    const res = await POST(mcpRequest(toolsCallBody("resolve_url", { code: "abc123" })));
    const message = await readJsonRpc(res);
    expect(message.result?.isError).toBeFalsy();
    const payload = JSON.parse(message.result!.content![0].text) as Record<string, unknown>;
    expect(payload).toEqual({
      code: "abc123",
      short_url: "https://sho.rt/abc123",
      long_url: "https://example.com/",
    });
  });
});

describe("unsupported methods on /api/chat/mcp", () => {
  it("returns 405 for GET", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });

  it("returns 405 for DELETE", async () => {
    const res = await DELETE();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
