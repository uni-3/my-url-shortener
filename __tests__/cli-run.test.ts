import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { createLink, getLink, deleteLink } = vi.hoisted(() => ({
  createLink: vi.fn(),
  getLink: vi.fn(),
  deleteLink: vi.fn(),
}));

vi.mock("@/cli/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/cli/client")>()),
  createLink,
  getLink,
  deleteLink,
}));

import { run } from "@/cli/run";
import { ApiError } from "@/cli/client";

const link = { code: "abc", short_url: "https://sho.rt/abc", long_url: "https://example.com/" };

describe("cli run", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.API_BASE_URL = "https://sho.rt";
    process.env.API_KEY = "env-key";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shorten posts the url and prints the short url", async () => {
    createLink.mockResolvedValue(link);
    expect(await run(["shorten", "https://example.com"])).toBe(0);
    expect(createLink).toHaveBeenCalledWith(
      { baseUrl: "https://sho.rt", apiKey: "env-key" },
      "https://example.com",
    );
    expect(vi.mocked(console.log)).toHaveBeenCalledWith("https://sho.rt/abc");
  });

  it("get prints the code and the long url", async () => {
    getLink.mockResolvedValue(link);
    expect(await run(["get", "abc"])).toBe(0);
    expect(vi.mocked(console.log)).toHaveBeenCalledWith("abc\thttps://example.com/");
  });

  it("delete reports the removed code", async () => {
    deleteLink.mockResolvedValue(undefined);
    expect(await run(["delete", "abc"])).toBe(0);
    expect(deleteLink).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "env-key" }), "abc");
  });

  it("lets --base-url and --key override the environment", async () => {
    delete process.env.API_BASE_URL;
    delete process.env.API_KEY;
    getLink.mockResolvedValue(link);
    expect(
      await run(["get", "abc", "--base-url", "https://flag.example", "--key", "flag-key"]),
    ).toBe(0);
    expect(getLink).toHaveBeenCalledWith(
      { baseUrl: "https://flag.example", apiKey: "flag-key" },
      "abc",
    );
  });

  it("exits 2 when no command is given", async () => {
    expect(await run([])).toBe(2);
  });

  it("reports an unknown command before checking credentials", async () => {
    delete process.env.API_BASE_URL;
    delete process.env.API_KEY;
    expect(await run(["frobnicate"])).toBe(2);
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      expect.stringContaining("不明なコマンド"),
    );
  });

  it("exits 2 when a required argument is missing", async () => {
    expect(await run(["shorten"])).toBe(2);
    expect(createLink).not.toHaveBeenCalled();
  });

  it("exits 2 for an unknown option", async () => {
    expect(await run(["get", "abc", "--bogus"])).toBe(2);
  });

  it("exits 2 when credentials are missing", async () => {
    delete process.env.API_BASE_URL;
    delete process.env.API_KEY;
    expect(await run(["get", "abc"])).toBe(2);
    expect(getLink).not.toHaveBeenCalled();
  });

  it("prints help and exits 0 with --help", async () => {
    expect(await run(["--help"])).toBe(0);
    expect(vi.mocked(console.log)).toHaveBeenCalled();
  });

  it("exits 1 and reports the message on an API error", async () => {
    getLink.mockRejectedValue(new ApiError(404, "見つかりません"));
    expect(await run(["get", "missing"])).toBe(1);
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("見つかりません"));
  });
});
