import { describe, it, expect } from "vitest";
import { checkRateLimit, enforceRateLimit } from "@/lib/api/rate-limit";

function fakeKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
  } as unknown as KVNamespace & { store: Map<string, string> };
}

const LIMIT = 60;

describe("checkRateLimit", () => {
  it("allows the request when no KV namespace is configured (fail-open)", async () => {
    const result = await checkRateLimit(undefined, "id");
    expect(result.allowed).toBe(true);
  });

  it("allows requests up to the limit and decrements remaining", async () => {
    const kv = fakeKV();
    const first = await checkRateLimit(kv, "id");
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(LIMIT - 1);

    for (let i = 1; i < LIMIT; i++) {
      expect((await checkRateLimit(kv, "id")).allowed).toBe(true);
    }
  });

  it("blocks the request once the limit is exceeded", async () => {
    const kv = fakeKV();
    for (let i = 0; i < LIMIT; i++) await checkRateLimit(kv, "id");

    const blocked = await checkRateLimit(kv, "id");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks identifiers independently", async () => {
    const kv = fakeKV();
    for (let i = 0; i < LIMIT; i++) await checkRateLimit(kv, "a");

    expect((await checkRateLimit(kv, "a")).allowed).toBe(false);
    expect((await checkRateLimit(kv, "b")).allowed).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  it("returns null when the request is allowed", async () => {
    expect(await enforceRateLimit(fakeKV(), "id")).toBeNull();
  });

  it("returns a 429 response with a Retry-After header when blocked", async () => {
    const kv = fakeKV();
    for (let i = 0; i < LIMIT; i++) await checkRateLimit(kv, "id");

    const response = await enforceRateLimit(kv, "id");
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect(Number(response!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
