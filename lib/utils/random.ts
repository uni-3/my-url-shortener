/**
 * Generates a random string for temporary use.
 * Uses cryptographically secure random values if available, otherwise falls back to Math.random.
 *
 * @param length - The length of the random string to generate.
 * @returns A random alphanumeric string.
 */
export function generateRandomString(length: number): string {
  try {
    const crypto = globalThis.crypto;
    if (crypto) {
      // Use randomUUID if available (and we want a full UUID or parts of it)
      if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID().replace(/-/g, "").slice(0, length);
      }

      // Fallback to getRandomValues
      const array = new Uint8Array(Math.ceil(length / 2));
      crypto.getRandomValues(array);
      return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, length);
    }
  } catch (error) {
    console.warn("Secure crypto not available, falling back to Math.random", error);
  }

  // Final fallback
  return Math.random().toString(36).slice(2, 2 + length);
}
