import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkUrlSafety } from "@/lib/api/safe-browsing";

describe("checkUrlSafety", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", "test-api-key");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should return safe: true when no matches are found", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const result = await checkUrlSafety("https://safe-url.com");
    expect(result).toEqual({ safe: true });
  });

  it("should return safe: false when matches are found", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        matches: [
          {
            threatType: "MALWARE",
            platformType: "ANY_PLATFORM",
            threatEntryType: "URL",
            threat: { url: "https://malware-url.com" },
          },
        ],
      }),
    } as Response);

    const result = await checkUrlSafety("https://malware-url.com");
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MALWARE");
  });

  it("should return safe: true when API key is missing", async () => {
    vi.stubEnv("GOOGLE_SAFE_BROWSING_API_KEY", "");
    const result = await checkUrlSafety("https://any-url.com");
    expect(result).toEqual({ safe: true });
  });

  it("should return safe: true and log error when API returns non-ok status", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    } as Response);

    const result = await checkUrlSafety("https://any-url.com");
    expect(result).toEqual({ safe: true });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
