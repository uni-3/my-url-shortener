import { vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Creates a mock DB client with Vitest mock functions.
 */
export const createMockDb = () => ({
  query: {
    urls: {
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
});

/**
 * Creates a mock KV namespace with Vitest mock functions.
 */
export const createMockKV = () => ({
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
});

/**
 * Creates a NextRequest object for testing API routes.
 */
export const createApiRequest = (
  url: string,
  options: { method?: string; body?: any; headers?: Record<string, string> } = {}
) => {
  const { method = "GET", body, headers } = options;
  return new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * Common test constants
 */
export const TEST_BASE_URL = "http://localhost:3000";
export const TEST_LONG_URL = "https://example.com/very-long-path-to-shorten";
export const TEST_SHORT_CODE = "abcd123";
