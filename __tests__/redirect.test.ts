import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/[code]/route";
import { db } from "@/db";
import { NextRequest } from "next/server";
import { notFound } from "next/navigation";

vi.mock("@/db", () => ({
  db: {
    query: {
      urls: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

describe("GET /[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to longUrl when shortCode exists", async () => {
    const mockEntry = {
      id: 1,
      longUrl: "https://example.com/foo",
      shortCode: "abcd12",
      createdAt: new Date(),
    };

    vi.mocked(db.query.urls.findFirst).mockResolvedValue(mockEntry as any);

    const request = new NextRequest("http://localhost:3000/abcd12");
    const params = Promise.resolve({ code: "abcd12" });

    const response = await GET(request, { params });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/foo");
  });

  it("should call notFound when shortCode does not exist", async () => {
    vi.mocked(db.query.urls.findFirst).mockResolvedValue(undefined as any);

    const notFoundError = new Error("NEXT_NOT_FOUND");
    (notFoundError as any).digest = "NEXT_NOT_FOUND";
    vi.mocked(notFound).mockImplementation(() => {
      throw notFoundError;
    });

    const request = new NextRequest("http://localhost:3000/invalid");
    const params = Promise.resolve({ code: "invalid" });

    await expect(GET(request, { params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("should return 500 when database query fails", async () => {
    vi.mocked(db.query.urls.findFirst).mockRejectedValue(new Error("DB Error") as any);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new NextRequest("http://localhost:3000/error");
    const params = Promise.resolve({ code: "error" });

    const response = await GET(request, { params });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Internal Server Error");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
