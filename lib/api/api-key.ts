import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Authorization: Bearer <API_KEY> ヘッダを検証する。 */
export function verifyApiKey(request: NextRequest, apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (token.length !== apiKey.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
}

/** APIキーから安定した不透明な識別子を作る（生のキーをKVキーに出さないため）。 */
export async function apiKeyId(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
  return Array.from(new Uint8Array(digest, 0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
