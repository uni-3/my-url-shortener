import { randomBytes } from "node:crypto";

/**
 * Generates a random alphanumeric string for temporary use.
 * Uses cryptographically secure random values.
 */
export function generateRandomString(length: number): string {
  // toString('hex') gives 2 characters per byte, so we need length/2 bytes.
  // We take more to be safe and then slice.
  return randomBytes(length).toString("hex").slice(0, length);
}
