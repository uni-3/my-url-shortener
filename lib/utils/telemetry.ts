import { NextRequest } from "next/server";
import { Span } from "@opentelemetry/api";

/**
 * Hashes a string using SHA-256 via Web Crypto API.
 * Returns a hex string.
 */
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sets user identification attributes on the provided OpenTelemetry span.
 * Uses a hashed IP address as the user ID for privacy, while still including
 * the raw IP for geolocation.
 *
 * @param span - The OpenTelemetry span to set attributes on.
 * @param request - The incoming Next.js request.
 */
export async function setUserAttributes(span: Span, request: NextRequest) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "127.0.0.1";

  const salt = process.env.IP_SALT;
  if (!salt) {
    throw new Error("IP_SALT environment variable is required but not set");
  }

  try {
    const hashHex = await sha256(ip + salt);

    span.setAttribute("id", hashHex);
    span.setAttribute("ip_address", ip);
  } catch (error) {
    console.error("Failed to hash IP address for telemetry:", error);
    // Fallback to setting just the IP if hashing fails, to maintain basic functionality
    span.setAttribute("ip_address", ip);
  }
}
