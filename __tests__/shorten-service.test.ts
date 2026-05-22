import { describe, it, expect, vi } from "vitest";
import { ShortenService } from "@/lib/core/shorten-service";
import { ShortenError } from "@/lib/core/errors";
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
    async create(longUrl, deriveCode) {
      const id = nextId++;
      const record: UrlRecord = { id, longUrl, shortCode: deriveCode(id), createdAt: "2026-01-01" };
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

const idGenerator: IdGenerator = {
  encode: (id) => `code${id}`,
  decode: (code) => (code.startsWith("code") ? Number(code.slice(4)) : null),
};

const allowAll = async () => ({ safe: true });

describe("ShortenService", () => {
  it("creates a new record for an unknown URL", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, idGenerator, allowAll);

    const result = await service.create("https://example.com");

    expect(result.isExisting).toBe(false);
    expect(result.record.shortCode).toBe("code1");
    expect(repo.records).toHaveLength(1);
  });

  it("normalizes the URL before storing", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, idGenerator, allowAll);

    const result = await service.create("https://example.com");

    expect(result.record.longUrl).toBe("https://example.com/");
  });

  it("returns the existing record instead of creating a duplicate", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, idGenerator, allowAll);

    const first = await service.create("https://example.com");
    const second = await service.create("https://example.com");

    expect(second.isExisting).toBe(true);
    expect(second.record.shortCode).toBe(first.record.shortCode);
    expect(repo.records).toHaveLength(1);
  });

  it("throws ShortenError for an unsafe URL and stores nothing", async () => {
    const repo = createFakeRepo();
    const unsafe = async () => ({ safe: false, threatType: "MALWARE" });
    const service = new ShortenService(repo, idGenerator, unsafe);

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
    const service = new ShortenService(repo, idGenerator, checkSafety);

    await service.create("https://example.com");
    checkSafety.mockClear();
    await service.create("https://example.com");

    expect(checkSafety).not.toHaveBeenCalled();
  });

  it("get returns the record for a known code and null otherwise", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, idGenerator, allowAll);

    const { record } = await service.create("https://example.com");

    expect(await service.get(record.shortCode)).toEqual(record);
    expect(await service.get("missing")).toBeNull();
  });

  it("delete removes a record and reports whether it existed", async () => {
    const repo = createFakeRepo();
    const service = new ShortenService(repo, idGenerator, allowAll);

    const { record } = await service.create("https://example.com");

    expect(await service.delete(record.shortCode)).toBe(true);
    expect(await service.delete(record.shortCode)).toBe(false);
  });
});
