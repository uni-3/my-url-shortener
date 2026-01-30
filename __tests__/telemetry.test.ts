import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { setUserAttributes } from "@/lib/utils/telemetry";
import { Span } from "@opentelemetry/api";

describe("setUserAttributes", () => {
  let mockSpan: { setAttribute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSpan = {
      setAttribute: vi.fn(),
    };
    process.env.IP_SALT = "test-salt";
  });

  it("should set id and ip_address attributes using cf-connecting-ip", () => {
    const request = new NextRequest("https://example.com", {
      headers: {
        "cf-connecting-ip": "1.2.3.4",
      },
    });

    setUserAttributes(mockSpan as unknown as Span, request);

    expect(mockSpan.setAttribute).toHaveBeenCalledWith("ip_address", "1.2.3.4");
    expect(mockSpan.setAttribute).toHaveBeenCalledWith("id", expect.any(String));

    // Verify the hash is consistent
    const call = mockSpan.setAttribute.mock.calls.find((c) => c[0] === "id");
    const hash = call ? call[1] : undefined;
    expect(hash).toHaveLength(64); // SHA-256 hex length
  });

  it("should fallback to x-forwarded-for if cf-connecting-ip is missing", () => {
    const request = new NextRequest("https://example.com", {
      headers: {
        "x-forwarded-for": "5.6.7.8, 1.2.3.4",
      },
    });

    setUserAttributes(mockSpan as unknown as Span, request);

    expect(mockSpan.setAttribute).toHaveBeenCalledWith("ip_address", "5.6.7.8");
  });

  it("should use default IP if no headers are present", () => {
    const request = new NextRequest("https://example.com");

    setUserAttributes(mockSpan as unknown as Span, request);

    expect(mockSpan.setAttribute).toHaveBeenCalledWith("ip_address", "127.0.0.1");
  });

  it("should produce different hashes for different IPs with the same salt", () => {
    const req1 = new NextRequest("https://example.com", { headers: { "cf-connecting-ip": "1.1.1.1" } });
    const req2 = new NextRequest("https://example.com", { headers: { "cf-connecting-ip": "2.2.2.2" } });

    const span1 = { setAttribute: vi.fn() } as unknown as Span;
    const span2 = { setAttribute: vi.fn() } as unknown as Span;

    setUserAttributes(span1, req1);
    setUserAttributes(span2, req2);

    const hash1 = vi.mocked(span1.setAttribute).mock.calls.find((c) => c[0] === "id")?.[1];
    const hash2 = vi.mocked(span2.setAttribute).mock.calls.find((c) => c[0] === "id")?.[1];

    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hashes for the same IP with different salts", () => {
    const req = new NextRequest("https://example.com", { headers: { "cf-connecting-ip": "1.1.1.1" } });

    const span1 = { setAttribute: vi.fn() } as unknown as Span;
    const span2 = { setAttribute: vi.fn() } as unknown as Span;

    process.env.IP_SALT = "salt1";
    setUserAttributes(span1, req);

    process.env.IP_SALT = "salt2";
    setUserAttributes(span2, req);

    const hash1 = vi.mocked(span1.setAttribute).mock.calls.find((c) => c[0] === "id")?.[1];
    const hash2 = vi.mocked(span2.setAttribute).mock.calls.find((c) => c[0] === "id")?.[1];

    expect(hash1).not.toBe(hash2);
  });
});
