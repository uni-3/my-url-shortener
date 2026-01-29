import { NextRequest } from "next/server";
import { Span } from "@opentelemetry/api";

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

  const salt = process.env.IP_SALT || "default-salt";

  try {
    const crypto = globalThis.crypto;
    if (crypto && crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(ip + salt);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      span.setAttribute("id", hashHex);
    } else {
      // In insecure contexts or older environments, crypto.subtle might be missing.
      // We still set ip_address for geolocation.
      console.warn("crypto.subtle is not available. Skipping IP hashing.");
    }

    span.setAttribute("ip_address", ip);
  } catch (error) {
    console.error("Failed to hash IP address for telemetry:", error);
    // Fallback to setting just the IP if hashing fails, to maintain basic functionality
    span.setAttribute("ip_address", ip);
  }
}
