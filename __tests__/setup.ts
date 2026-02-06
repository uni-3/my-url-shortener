import "@testing-library/jest-dom";
import { webcrypto } from "node:crypto";

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
