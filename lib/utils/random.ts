/**
 * Generates a random alphanumeric string for temporary use.
 * Uses cryptographically secure random values.
 *
 * @param length - The length of the random string to generate.
 * @returns A random alphanumeric string.
 */
export function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);

  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without secure crypto
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(array)
    .map((x) => chars[x % chars.length])
    .join("");
}
