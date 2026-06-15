import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
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

import { v1App } from "@/lib/api/v1/app";

const API_KEY = "test-api-key";
const record: UrlRecord = {
  id: 1,
  longUrl: "https://example.com/",
  shortCode: "abc123",
  createdAt: "2026-05-22",
};

interface JsonBody {
  error?: { message: string; threatType?: string };
  code?: string;
  short_url?: string;
  long_url?: string;
}

async function json(res: Response): Promise<JsonBody> {
  return res.json() as Promise<JsonBody>;
}

function authHeaders(withAuth: boolean): Record<string, string> {
  return withAuth ? { Authorization: `Bearer ${API_KEY}` } : {};
}

function post(body: unknown, withAuth = true) {
  return v1App.request("https://sho.rt/api/v1/links", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(withAuth) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function get(code: string, withAuth = true) {
  return v1App.request(`https://sho.rt/api/v1/links/${code}`, {
    headers: authHeaders(withAuth),
  });
}

function del(code: string, withAuth = true) {
  return v1App.request(`https://sho.rt/api/v1/links/${code}`, {
    method: "DELETE",
    headers: authHeaders(withAuth),
  });
}

describe("POST /api/v1/links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = API_KEY;
  });

  it("returns 401 with a structured error when the API key is missing", async () => {
    const res = await post({ url: "https://example.com" }, false);
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({ error: { message: expect.any(String) } });
  });

  it("returns 400 for an unparseable body", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect((await json(res)).error?.message).toBeTruthy();
  });

  it("returns 400 for an invalid URL", async () => {
    const res = await post({ url: "not-a-url" });
    expect(res.status).toBe(400);
    expect((await json(res)).error?.message).toBeTruthy();
  });

  it("returns 201 with the link payload for a new URL", async () => {
    mockService.create.mockResolvedValue({ record, isExisting: false });
    const res = await post({ url: "https://example.com" });
    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({
      code: "abc123",
      short_url: "https://sho.rt/abc123",
      long_url: "https://example.com/",
    });
  });

  it("returns 200 when the URL already exists", async () => {
    mockService.create.mockResolvedValue({ record, isExisting: true });
    const res = await post({ url: "https://example.com" });
    expect(res.status).toBe(200);
    expect((await json(res)).code).toBe("abc123");
  });

  it("returns 403 with the threat type when the URL is unsafe", async () => {
    mockService.create.mockRejectedValue(
      new ShortenError("UNSAFE_URL", "unsafe", { threatType: "MALWARE" }),
    );
    const res = await post({ url: "https://malware.test" });
    expect(res.status).toBe(403);
    expect((await json(res)).error?.threatType).toBe("MALWARE");
  });
});

describe("GET /api/v1/links/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = API_KEY;
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await get("abc123", false);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the code does not exist", async () => {
    mockService.get.mockResolvedValue(null);
    const res = await get("missing");
    expect(res.status).toBe(404);
    expect((await json(res)).error?.message).toBeTruthy();
  });

  it("returns 200 with the link payload for an existing code", async () => {
    mockService.get.mockResolvedValue(record);
    const res = await get("abc123");
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      code: "abc123",
      short_url: "https://sho.rt/abc123",
      long_url: "https://example.com/",
    });
  });
});

describe("DELETE /api/v1/links/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = API_KEY;
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await del("abc123", false);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the code does not exist", async () => {
    mockService.delete.mockResolvedValue(false);
    const res = await del("missing");
    expect(res.status).toBe(404);
    expect((await json(res)).error?.message).toBeTruthy();
  });

  it("returns 204 when the link is deleted", async () => {
    mockService.delete.mockResolvedValue(true);
    const res = await del("abc123");
    expect(res.status).toBe(204);
  });
});

describe("rate limiting on /api/v1/links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = API_KEY;
  });

  it("returns the 429 response when the rate limiter rejects the request", async () => {
    mockEnforceApiRateLimit.mockResolvedValue(new NextResponse(null, { status: 429 }));
    const res = await post({ url: "https://example.com" });
    expect(res.status).toBe(429);
    expect(mockService.create).not.toHaveBeenCalled();
  });
});
