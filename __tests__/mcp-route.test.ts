// @vitest-environment node
// mcp-handler は node:http / node:net 等のビルトインを使うため、jsdomではなくnode環境で実行する。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ShortenError } from "@/lib/core/errors";
import type { UrlRecord } from "@/lib/core/repository";

const { mockService, mockEnforceApiRateLimit } = vi.hoisted(() => ({
  mockService: { create: vi.fn(), get: vi.fn(), delete: vi.fn() },
  mockEnforceApiRateLimit: vi.fn(),
}));

vi.mock("@/lib/core/build", () => ({
  buildService: () => mockService,
}));

vi.mock("@/lib/api/rate-limit", () => ({
  enforceApiRateLimit: mockEnforceApiRateLimit,
}));

import { POST, GET, DELETE } from "@/app/mcp/route";

const API_KEY = "test-api-key";
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

function mcpRequest(body: unknown, withAuth: boolean | string = true) {
  return new NextRequest("https://sho.rt/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(withAuth
        ? { Authorization: `Bearer ${withAuth === true ? API_KEY : withAuth}` }
        : {}),
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
  process.env.API_KEY = API_KEY;
  mockEnforceApiRateLimit.mockResolvedValue(null);
});

describe("POST /mcp authentication", () => {
  it("returns 401 when the API key is missing", async () => {
    const res = await POST(mcpRequest(toolsListBody(), false));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBeTruthy();
  });

  it("returns 401 when the API key is wrong", async () => {
    const res = await POST(mcpRequest(toolsListBody(), "wrong-api-key"));
    expect(res.status).toBe(401);
  });

  it("returns the 429 response when the rate limiter rejects the request", async () => {
    mockEnforceApiRateLimit.mockResolvedValue(new NextResponse(null, { status: 429 }));
    const res = await POST(mcpRequest(toolsListBody()));
    expect(res.status).toBe(429);
  });
});

describe("POST /mcp tools/list", () => {
  it("lists the shorten_url and resolve_url tools", async () => {
    const res = await POST(mcpRequest(toolsListBody()));
    expect(res.status).toBe(200);
    const message = await readJsonRpc(res);
    const names = message.result?.tools?.map((tool) => tool.name);
    expect(names).toContain("shorten_url");
    expect(names).toContain("resolve_url");
    expect(names).toHaveLength(2);
  });
});

describe("POST /mcp tools/call shorten_url", () => {
  it("returns the link payload for a new URL", async () => {
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

  it("returns an error result for an invalid URL", async () => {
    const res = await POST(mcpRequest(toolsCallBody("shorten_url", { url: "not-a-url" })));
    const message = await readJsonRpc(res);
    expect(message.result?.isError).toBe(true);
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("returns an error result with the threat type for an unsafe URL", async () => {
    mockService.create.mockRejectedValue(
      new ShortenError("UNSAFE_URL", "unsafe", { threatType: "MALWARE" }),
    );
    const res = await POST(
      mcpRequest(toolsCallBody("shorten_url", { url: "https://malware.test" })),
    );
    const message = await readJsonRpc(res);
    expect(message.result?.isError).toBe(true);
    expect(message.result?.content?.[0].text).toContain("MALWARE");
  });
});

describe("POST /mcp tools/call resolve_url", () => {
  it("returns the link payload for an existing code", async () => {
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

  it("returns an error result when the code does not exist", async () => {
    mockService.get.mockResolvedValue(null);
    const res = await POST(mcpRequest(toolsCallBody("resolve_url", { code: "missing" })));
    const message = await readJsonRpc(res);
    expect(message.result?.isError).toBe(true);
    expect(message.result?.content?.[0].text).toContain("存在しません");
  });
});

describe("unsupported methods on /mcp", () => {
  it("returns 405 for GET", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("returns 405 for DELETE", async () => {
    const res = await DELETE();
    expect(res.status).toBe(405);
  });
});
