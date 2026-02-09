import "@testing-library/jest-dom";
import { webcrypto } from "node:crypto";
import { vi } from "vitest";

// Polyfill crypto for jsdom environment if missing
if (typeof globalThis.crypto === "undefined") {
  // @ts-ignore
  globalThis.crypto = webcrypto;
} else {
  if (typeof globalThis.crypto.subtle === "undefined") {
    // @ts-ignore
    globalThis.crypto.subtle = webcrypto.subtle;
  }
  if (typeof globalThis.crypto.randomUUID === "undefined") {
    // @ts-ignore
    globalThis.crypto.randomUUID = webcrypto.randomUUID;
  }
}

// Mock environment variables for testing
process.env.IP_SALT = "test-salt";

// Mock @opennextjs/cloudflare
vi.mock("@opennextjs/cloudflare", () => ({
  initOpenNextCloudflareForDev: vi.fn(),
  getCloudflareContext: vi.fn(async () => ({
    env: process.env,
    cf: {},
    ctx: {},
  })),
}));
