import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ShortenError } from "@/lib/core/errors";
import type { UrlRecord } from "@/lib/core/repository";

const { mockService } = vi.hoisted(() => ({
  mockService: { create: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/core/build", () => ({
  buildService: () => mockService,
}));

import { POST } from "@/app/api/v1/links/route";
import { DELETE, GET } from "@/app/api/v1/links/[code]/route";

const API_KEY = "test-api-key";
const record: UrlRecord = {
  id: 1,
  longUrl: "https://example.com/",
  shortCode: "abc123",
  createdAt: "2026-05-22",
};

interface JsonBody {
  error?: { code: string; message: string };
  code?: string;
  short_url?: string;
  long_url?: string;
}

async function json(res: Response): Promise<JsonBody> {
  return res.json() as Promise<JsonBody>;
}

function postRequest(body: unknown, withAuth = true) {
  return new NextRequest("https://sho.rt/api/v1/links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function getRequest(code: string, withAuth = true) {
  const request = new NextRequest(`https://sho.rt/api/v1/links/${code}`, {
    headers: withAuth ? { Authorization: `Bearer ${API_KEY}` } : {},
  });
  return GET(request, { params: Promise.resolve({ code }) });
}

function deleteRequest(code: string, withAuth = true) {
  const request = new NextRequest(`https://sho.rt/api/v1/links/${code}`, {
    method: "DELETE",
    headers: withAuth ? { Authorization: `Bearer ${API_KEY}` } : {},
  });
  return DELETE(request, { params: Promise.resolve({ code }) });
}

describe("POST /api/v1/links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = API_KEY;
  });

  it("returns 401 with a structured error when the API key is missing", async () => {
    const res = await POST(postRequest({ url: "https://example.com" }, false));
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({
      error: { code: "UNAUTHORIZED", message: expect.any(String) },
    });
  });

  it("returns 400 INVALID_JSON for an unparseable body", async () => {
    const res = await POST(postRequest("{not json"));
    expect(res.status).toBe(400);
    expect((await json(res)).error?.code).toBe("INVALID_JSON");
  });

  it("returns 400 INVALID_URL for an invalid URL", async () => {
    const res = await POST(postRequest({ url: "not-a-url" }));
    expect(res.status).toBe(400);
    expect((await json(res)).error?.code).toBe("INVALID_URL");
  });

  it("returns 201 with the link payload for a new URL", async () => {
    mockService.create.mockResolvedValue({ record, isExisting: false });
    const res = await POST(postRequest({ url: "https://example.com" }));
    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({
      code: "abc123",
      short_url: "https://sho.rt/abc123",
      long_url: "https://example.com/",
    });
  });

  it("returns 200 when the URL already exists", async () => {
    mockService.create.mockResolvedValue({ record, isExisting: true });
    const res = await POST(postRequest({ url: "https://example.com" }));
    expect(res.status).toBe(200);
    expect((await json(res)).code).toBe("abc123");
  });

  it("returns 403 UNSAFE_URL when the service rejects the URL", async () => {
    mockService.create.mockRejectedValue(
      new ShortenError("UNSAFE_URL", "unsafe", { threatType: "MALWARE" }),
    );
    const res = await POST(postRequest({ url: "https://malware.test" }));
    expect(res.status).toBe(403);
    expect((await json(res)).error?.code).toBe("UNSAFE_URL");
  });
});

describe("GET /api/v1/links/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = API_KEY;
  });

  it("returns 401 when the API key is missing", async () => {
    const res = await getRequest("abc123", false);
    expect(res.status).toBe(401);
    expect((await json(res)).error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 NOT_FOUND when the code does not exist", async () => {
    mockService.get.mockResolvedValue(null);
    const res = await getRequest("missing");
    expect(res.status).toBe(404);
    expect((await json(res)).error?.code).toBe("NOT_FOUND");
  });

  it("returns 200 with the link payload for an existing code", async () => {
    mockService.get.mockResolvedValue(record);
    const res = await getRequest("abc123");
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
    const res = await deleteRequest("abc123", false);
    expect(res.status).toBe(401);
  });

  it("returns 404 NOT_FOUND when the code does not exist", async () => {
    mockService.delete.mockResolvedValue(false);
    const res = await deleteRequest("missing");
    expect(res.status).toBe(404);
    expect((await json(res)).error?.code).toBe("NOT_FOUND");
  });

  it("returns 204 when the link is deleted", async () => {
    mockService.delete.mockResolvedValue(true);
    const res = await deleteRequest("abc123");
    expect(res.status).toBe(204);
  });
});
