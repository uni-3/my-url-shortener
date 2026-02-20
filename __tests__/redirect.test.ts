import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/[code]/route";
import { notFound } from "next/navigation";
import { Env } from "@/lib/types/env";
import {
  createMockDb,
  createMockKV,
  createApiRequest,
  TEST_BASE_URL,
  TEST_LONG_URL,
  TEST_SHORT_CODE
} from "./utils/test-helpers";

// Setup Mocks
const mockDb = createMockDb();
const mockKV = createMockKV();

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
    // Arrange
    vi.mocked(mockKV.get).mockResolvedValue(TEST_LONG_URL);
    (process.env as unknown as Env).URL_CACHE = mockKV as unknown as KVNamespace;

    const request = createApiRequest(`${TEST_BASE_URL}/${TEST_SHORT_CODE}`);
    const params = Promise.resolve({ code: TEST_SHORT_CODE });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(TEST_LONG_URL);
    expect(mockKV.get).toHaveBeenCalledWith(TEST_SHORT_CODE);
    expect(mockDb.query.urls.findFirst).not.toHaveBeenCalled();
  });

  it("should redirect to longUrl when shortCode exists in DB (cache miss)", async () => {
    // Arrange
    vi.mocked(mockKV.get).mockResolvedValue(null);
    (process.env as unknown as Env).URL_CACHE = mockKV as unknown as KVNamespace;

    const mockEntry = {
      id: 1,
      longUrl: TEST_LONG_URL,
      shortCode: TEST_SHORT_CODE,
      createdAt: new Date(),
    };
    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(mockEntry);

    const request = createApiRequest(`${TEST_BASE_URL}/${TEST_SHORT_CODE}`);
    const params = Promise.resolve({ code: TEST_SHORT_CODE });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(TEST_LONG_URL);
    expect(mockKV.put).toHaveBeenCalledWith(TEST_SHORT_CODE, TEST_LONG_URL, { expirationTtl: 86400 });
  });

  it("should call notFound when shortCode does not exist", async () => {
    // Arrange
    vi.mocked(mockKV.get).mockResolvedValue(null);
    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(undefined);

    const notFoundError = new Error("NEXT_NOT_FOUND") as Error & { digest: string };
    notFoundError.digest = "NEXT_NOT_FOUND";
    vi.mocked(notFound).mockImplementation(() => {
      throw notFoundError;
    });

    const request = createApiRequest(`${TEST_BASE_URL}/invalid`);
    const params = Promise.resolve({ code: "invalid" });

    // Act & Assert
    await expect(GET(request, { params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("should return 500 when database query fails", async () => {
    // Arrange
    vi.mocked(mockKV.get).mockResolvedValue(null);
    vi.mocked(mockDb.query.urls.findFirst).mockRejectedValue(new Error("DB Error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = createApiRequest(`${TEST_BASE_URL}/error`);
    const params = Promise.resolve({ code: "error" });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(500);
    const data = await response.json() as { error: string };
    expect(data.error).toBe("Internal Server Error");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

