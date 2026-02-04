/**
 * Generates a random alphanumeric string for temporary use.
 * Uses Web Crypto API for edge runtime compatibility.
 */
export function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  // Convert to hex string
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}
