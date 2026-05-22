import { describe, it, expect, vi } from "vitest";
import { ShortenService } from "@/lib/core/shorten-service";
import { CodeCollisionError, ShortenError } from "@/lib/core/errors";
import type { UrlRecord, UrlRepository } from "@/lib/core/repository";
import type { IdGenerator } from "@/lib/core/id-generator";

function createFakeRepo(): UrlRepository & { records: UrlRecord[] } {
  const records: UrlRecord[] = [];
  let nextId = 1;
  return {
    records,
    async findByLongUrl(longUrl) {
      return records.find((r) => r.longUrl === longUrl) ?? null;
    },
    async findByCode(code) {
      return records.find((r) => r.shortCode === code) ?? null;
    },
    async create(longUrl, shortCode) {
      if (records.some((r) => r.shortCode === shortCode)) {
        throw new CodeCollisionError(shortCode);
      }
      const record: UrlRecord = { id: nextId++, longUrl, shortCode, createdAt: "2026-01-01" };
      records.push(record);
      return record;
    },
    async deleteByCode(code) {
      const idx = records.findIndex((r) => r.shortCode === code);
      if (idx === -1) return false;
      records.splice(idx, 1);
      return true;
    },
  };
}

/** 呼び出すたびに与えたコードを順に返し、尽きたら最後のコードを返し続ける生成器。 */
function fakeGenerator(...codes: string[]): IdGenerator {
  let i = 0;
  return { generate: () => codes[Math.min(i++, codes.length - 1)] };
}

const allowAll = async () => ({ safe: true });

describe("ShortenService", () => {
  it("creates a new record for an unknown URL", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, fakeGenerator("abc123"), allowAll);

    const result = await service.create("https://example.com");

    expect(result.isExisting).toBe(false);
    expect(result.record.shortCode).toBe("abc123");
    expect(repo.records).toHaveLength(1);
  });

  it("normalizes the URL before storing", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, fakeGenerator("abc123"), allowAll);

    const result = await service.create("https://example.com");

    expect(result.record.longUrl).toBe("https://example.com/");
  });

  it("returns the existing record instead of creating a duplicate", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, fakeGenerator("abc123", "def456"), allowAll);

    const first = await service.create("https://example.com");
    const second = await service.create("https://example.com");

    expect(second.isExisting).toBe(true);
    expect(second.record.shortCode).toBe(first.record.shortCode);
    expect(repo.records).toHaveLength(1);
  });

  it("throws ShortenError for an unsafe URL and stores nothing", async () => {
    const repo = createFakeRepo();
    const unsafe = async () => ({ safe: false, threatType: "MALWARE" });
    const service = new ShortenService(repo, fakeGenerator("abc123"), unsafe);

    await expect(service.create("https://malware.test")).rejects.toBeInstanceOf(ShortenError);
    await expect(service.create("https://malware.test")).rejects.toMatchObject({
      code: "UNSAFE_URL",
      detail: { threatType: "MALWARE" },
    });
    expect(repo.records).toHaveLength(0);
  });

  it("skips the safety check for an already-known URL", async () => {
    const repo = createFakeRepo();
    const checkSafety = vi.fn(allowAll);
    const service = new ShortenService(repo, fakeGenerator("abc123"), checkSafety);

    await service.create("https://example.com");
    checkSafety.mockClear();
    await service.create("https://example.com");

    expect(checkSafety).not.toHaveBeenCalled();
  });

  it("retries with a new code when the generated code collides", async () => {
    const repo = createFakeRepo();
    // 2件目の生成は1件目と同じコード -> 衝突 -> 別コードで再試行
    const service = new ShortenService(repo, fakeGenerator("dup", "dup", "fresh"), allowAll);

    const first = await service.create("https://a.example");
    const second = await service.create("https://b.example");

    expect(first.record.shortCode).toBe("dup");
    expect(second.record.shortCode).toBe("fresh");
    expect(repo.records).toHaveLength(2);
  });

  it("throws CodeCollisionError after exhausting code generation attempts", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, fakeGenerator("taken"), allowAll);

    await service.create("https://a.example");

    await expect(service.create("https://b.example")).rejects.toBeInstanceOf(CodeCollisionError);
    expect(repo.records).toHaveLength(1);
  });

  it("get returns the record for a known code and null otherwise", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, fakeGenerator("abc123"), allowAll);

    const { record } = await service.create("https://example.com");

    expect(await service.get(record.shortCode)).toEqual(record);
    expect(await service.get("missing")).toBeNull();
  });

  it("delete removes a record and reports whether it existed", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, fakeGenerator("abc123"), allowAll);

    const { record } = await service.create("https://example.com");

    expect(await service.delete(record.shortCode)).toBe(true);
    expect(await service.delete(record.shortCode)).toBe(false);
  });
});
