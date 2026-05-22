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
