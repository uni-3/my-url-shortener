import { timingSafeEqual } from "node:crypto";

/** Authorization: Bearer <API_KEY> ヘッダを検証する。NextRequest / 標準 Request の両方を受ける。 */
export function verifyApiKey(request: Request, apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (token.length !== apiKey.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
}

/** SHA-256ハッシュを16進文字列で返す。秘匿したい値から不透明な識別子を作るのに使う。 */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** APIキーから安定した不透明な識別子を作る（生のキーをKVキーに出さないため）。 */
export async function apiKeyId(apiKey: string): Promise<string> {
  return sha256Hex(apiKey);
}
