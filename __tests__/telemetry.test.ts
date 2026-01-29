import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { setUserAttributes } from "@/lib/utils/telemetry";
import { Span } from "@opentelemetry/api";

describe("setUserAttributes", () => {
  let mockSpan: any;

  beforeEach(() => {
    mockSpan = {
      setAttribute: vi.fn(),
    };
    process.env.IP_SALT = "test-salt";
  });

  it("should set id and ip_address attributes using cf-connecting-ip", async () => {
    const request = new NextRequest("https://example.com", {
      headers: {
        "cf-connecting-ip": "1.2.3.4",
      },
    });

    await setUserAttributes(mockSpan as unknown as Span, request);

    expect(mockSpan.setAttribute).toHaveBeenCalledWith("ip_address", "1.2.3.4");
    expect(mockSpan.setAttribute).toHaveBeenCalledWith("id", expect.any(String));

    // Verify the hash is consistent
    const call = mockSpan.setAttribute.mock.calls.find((c: any) => c[0] === "id");
    const hash = call[1];
    expect(hash).toHaveLength(64); // SHA-256 hex length
  });

  it("should fallback to x-forwarded-for if cf-connecting-ip is missing", async () => {
    const request = new NextRequest("https://example.com", {
      headers: {
        "x-forwarded-for": "5.6.7.8, 1.2.3.4",
      },
    });

    await setUserAttributes(mockSpan as unknown as Span, request);

    expect(mockSpan.setAttribute).toHaveBeenCalledWith("ip_address", "5.6.7.8");
  });

  it("should use default IP if no headers are present", async () => {
    const request = new NextRequest("https://example.com");

    await setUserAttributes(mockSpan as unknown as Span, request);

    expect(mockSpan.setAttribute).toHaveBeenCalledWith("ip_address", "127.0.0.1");
  });

  it("should produce different hashes for different IPs with the same salt", async () => {
    const req1 = new NextRequest("https://example.com", { headers: { "cf-connecting-ip": "1.1.1.1" } });
    const req2 = new NextRequest("https://example.com", { headers: { "cf-connecting-ip": "2.2.2.2" } });

    const span1 = { setAttribute: vi.fn() };
    const span2 = { setAttribute: vi.fn() };

    await setUserAttributes(span1 as any, req1);
    await setUserAttributes(span2 as any, req2);

    const hash1 = span1.setAttribute.mock.calls.find((c: any) => c[0] === "id")[1];
    const hash2 = span2.setAttribute.mock.calls.find((c: any) => c[0] === "id")[1];

    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hashes for the same IP with different salts", async () => {
    const req = new NextRequest("https://example.com", { headers: { "cf-connecting-ip": "1.1.1.1" } });

    const span1 = { setAttribute: vi.fn() };
    const span2 = { setAttribute: vi.fn() };

    process.env.IP_SALT = "salt1";
    await setUserAttributes(span1 as any, req);

    process.env.IP_SALT = "salt2";
    await setUserAttributes(span2 as any, req);

    const hash1 = span1.setAttribute.mock.calls.find((c: any) => c[0] === "id")[1];
    const hash2 = span2.setAttribute.mock.calls.find((c: any) => c[0] === "id")[1];

    expect(hash1).not.toBe(hash2);
  });
});
