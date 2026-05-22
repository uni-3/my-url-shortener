import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, enforceRateLimit, type RateLimitStore } from "@/lib/api/rate-limit";

/** D1RateLimitStore と同じ「同ウィンドウなら+1、変われば1」のセマンティクスを持つインメモリ実装。 */
function fakeStore(): RateLimitStore {
  const rows = new Map<string, { count: number; windowStart: number }>();
  return {
    async increment(id, windowStart) {
      const existing = rows.get(id);
      const count = existing && existing.windowStart === windowStart ? existing.count + 1 : 1;
      rows.set(id, { count, windowStart });
      return count;
    },
  };
}

const LIMIT = 60;

describe("rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", async () => {
    const store = fakeStore();
    for (let i = 0; i < LIMIT; i++) {
      expect((await checkRateLimit(store, "id")).allowed).toBe(true);
    }
  });

  it("blocks the request once the limit is exceeded", async () => {
    const store = fakeStore();
    for (let i = 0; i < LIMIT; i++) await checkRateLimit(store, "id");

    expect((await checkRateLimit(store, "id")).allowed).toBe(false);
  });

  it("tracks identifiers independently", async () => {
    const store = fakeStore();
    for (let i = 0; i < LIMIT; i++) await checkRateLimit(store, "a");

    expect((await checkRateLimit(store, "a")).allowed).toBe(false);
    expect((await checkRateLimit(store, "b")).allowed).toBe(true);
  });

  it("counts a fresh window from one again", async () => {
    const store = fakeStore();
    for (let i = 0; i < LIMIT; i++) await checkRateLimit(store, "id");
    expect((await checkRateLimit(store, "id")).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-05-22T00:05:00Z"));
    expect((await checkRateLimit(store, "id")).allowed).toBe(true);
  });

  it("enforceRateLimit returns null when allowed", async () => {
    expect(await enforceRateLimit(fakeStore(), "id")).toBeNull();
  });

  it("enforceRateLimit returns a 429 with Retry-After when blocked", async () => {
    const store = fakeStore();
    for (let i = 0; i < LIMIT; i++) await checkRateLimit(store, "id");

    const response = await enforceRateLimit(store, "id");
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect(Number(response!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
