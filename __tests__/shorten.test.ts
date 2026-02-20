import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/shorten/route";
import { checkUrlSafety } from "@/lib/api/safe-browsing";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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

vi.mock("@/lib/api/safe-browsing", () => ({
  checkUrlSafety: vi.fn(),
}));

vi.mock("@/lib/utils/random", () => ({
  generateRandomString: () => "random123",
}));

vi.mock("@opentelemetry/api", () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: vi.fn((_name, callback) => callback({
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      })),
    }),
  },
  SpanStatusCode: { OK: 1, ERROR: 2 },
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(),
}));

describe("POST /api/shorten", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup
    vi.mocked(checkUrlSafety).mockResolvedValue({ safe: true });
    vi.mocked(getCloudflareContext).mockResolvedValue({
      env: { URL_CACHE: mockKV } as any,
      cf: {} as any,
      ctx: {} as any,
    });
  });

  it("should create a new short URL successfully", async () => {
    // Arrange
    const insertedId = 123;
    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(undefined as any);
    vi.mocked(mockDb.returning).mockResolvedValue([{ id: insertedId }] as any);

    const request = createApiRequest(`${TEST_BASE_URL}/api/shorten`, {
      method: "POST",
      body: { url: TEST_LONG_URL },
    });

    // Act
    const response = await POST(request);
    const data = await response.json() as { shortCode: string; url: string };

    // Assert
    expect(response.status).toBe(201);
    expect(data.shortCode).toBeDefined();
    expect(data.url).toContain("https://example.com/very-long-path-to-shorten/"); // Normalized

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockKV.put).toHaveBeenCalledWith(data.shortCode, data.url, { expirationTtl: 86400 });
  });

  it("should return existing shortCode for already registered URL", async () => {
    // Arrange
    const existingEntry = {
      id: 1,
      shortCode: TEST_SHORT_CODE,
      longUrl: `${TEST_LONG_URL}/`,
    };
    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(existingEntry);

    const request = createApiRequest(`${TEST_BASE_URL}/api/shorten`, {
      method: "POST",
      body: { url: TEST_LONG_URL },
    });

    // Act
    const response = await POST(request);
    const data = await response.json() as { shortCode: string };

    // Assert
    expect(response.status).toBe(200);
    expect(data.shortCode).toBe(TEST_SHORT_CODE);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockKV.put).toHaveBeenCalledWith(TEST_SHORT_CODE, expect.any(String), expect.any(Object));
  });

  it("should return 400 for invalid URL", async () => {
    // Arrange
    const request = createApiRequest(`${TEST_BASE_URL}/api/shorten`, {
      method: "POST",
      body: { url: "not-a-url" },
    });

    // Act
    const response = await POST(request);
    const data = await response.json() as { error: string };

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 403 for unsafe URL", async () => {
    // Arrange
    vi.mocked(mockDb.query.urls.findFirst).mockResolvedValue(undefined as any);
    vi.mocked(checkUrlSafety).mockResolvedValue({
      safe: false,
      threatType: "MALWARE"
    });

    const request = createApiRequest(`${TEST_BASE_URL}/api/shorten`, {
      method: "POST",
      body: { url: "https://malware.com" },
    });

    // Act
    const response = await POST(request);
    const data = await response.json() as { error: string; threatType: string };

    // Assert
    expect(response.status).toBe(403);
    expect(data.error).toContain("安全ではない可能");
    expect(data.threatType).toBe("MALWARE");
  });

  it("should return 500 when database operation fails", async () => {
    // Arrange
    vi.mocked(mockDb.query.urls.findFirst).mockRejectedValue(new Error("DB Connection Error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = createApiRequest(`${TEST_BASE_URL}/api/shorten`, {
      method: "POST",
      body: { url: TEST_LONG_URL },
    });

    // Act
    const response = await POST(request);
    const data = await response.json() as { error: string };

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toBe("URLの短縮に失敗しました");

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

