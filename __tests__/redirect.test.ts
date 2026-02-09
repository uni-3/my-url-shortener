import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/[code]/route";
import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { Env } from "@/lib/types/env";

const mockDb = {
  query: {
    urls: {
      findFirst: vi.fn(),
    },
  },
};

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

describe("GET /[code]", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it("should return cached response if KV hit occurs", async () => {
    const mockKV = {
      get: vi.fn().mockResolvedValue("https://cached-example.com/foo"),
      put: vi.fn(),
    } as unknown as KVNamespace;
    (process.env as unknown as Env).URL_CACHE = mockKV;

    const request = new NextRequest("http://localhost:3000/abcd12");
    const params = Promise.resolve({ code: "abcd12" });

    const response = await GET(request, { params });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://cached-example.com/foo");
    expect(mockKV.get).toHaveBeenCalledWith("abcd12");
    // DB shouldn't be called on cache hit
    expect(mockDb.query.urls.findFirst).not.toHaveBeenCalled();
  });

  it("should redirect to longUrl when shortCode exists", async () => {
    const mockEntry = {
      id: 1,
      longUrl: "https://example.com/foo",
      shortCode: "abcd12",
      createdAt: new Date(),
    };

    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(mockEntry);

    const request = new NextRequest("http://localhost:3000/abcd12");
    const params = Promise.resolve({ code: "abcd12" });

    const response = await GET(request, { params });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/foo");
  });

  it("should populate cache on cache miss", async () => {
    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;
    (process.env as unknown as Env).URL_CACHE = mockKV;

    const mockEntry = {
      id: 1,
      longUrl: "https://example.com/foo",
      shortCode: "abcd12",
      createdAt: new Date(),
    };
    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(mockEntry);

    const request = new NextRequest("http://localhost:3000/abcd12");
    const params = Promise.resolve({ code: "abcd12" });

    await GET(request, { params });

    expect(mockKV.get).toHaveBeenCalledWith("abcd12");
    expect(mockKV.put).toHaveBeenCalledWith("abcd12", "https://example.com/foo", { expirationTtl: 86400 });
  });

  it("should call notFound when shortCode does not exist", async () => {
    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(undefined);

    const notFoundError = new Error("NEXT_NOT_FOUND") as Error & { digest: string };
    notFoundError.digest = "NEXT_NOT_FOUND";
    vi.mocked(notFound).mockImplementation(() => {
      throw notFoundError;
    });

    const request = new NextRequest("http://localhost:3000/invalid");
    const params = Promise.resolve({ code: "invalid" });

    await expect(GET(request, { params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("should return 500 when database query fails", async () => {
    vi.mocked(mockDb.query.urls.findFirst).mockRejectedValue(new Error("DB Error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new NextRequest("http://localhost:3000/error");
    const params = Promise.resolve({ code: "error" });

    const response = await GET(request, { params });

    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBe("Internal Server Error");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
