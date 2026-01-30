/**
 * Generates a random alphanumeric string for temporary use.
 * Uses cryptographically secure random values.
 */
export function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);

  // Use secure crypto if available, otherwise fallback to Math.random
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(array)
    .map((x) => chars[x % chars.length])
    .join("");
}
