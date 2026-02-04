import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("url-shortener");

export async function checkUrlSafety(url: string): Promise<{ safe: boolean; threatType?: string }> {
  return tracer.startActiveSpan("check-url-safety", async (span) => {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_SAFE_BROWSING_API_KEY is not set. Skipping safety check.");
    return { safe: true };
  }

  // v5alpha1 (v5) endpoint
  const endpoint = `https://safebrowsing.googleapis.com/v5alpha1/urls:search?key=${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls: [url],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Google Safe Browsing API error:", response.status, errorData);
      // APIエラー時は安全とみなして続行（フェイルセーフ）
      return { safe: true };
    }

    interface SafeBrowsingMatch {
      threatType: string;
      url: string;
    }

    interface SafeBrowsingResponse {
      matches?: SafeBrowsingMatch[];
    }

    const data = (await response.json()) as SafeBrowsingResponse;

    if (data.matches && data.matches.length > 0) {
      span.setAttribute("safe", false);
      span.setAttribute("threat_type", data.matches[0].threatType);
      return {
        safe: false,
        threatType: data.matches[0].threatType,
      };
    }

    span.setAttribute("safe", true);
    span.setStatus({ code: SpanStatusCode.OK });
    return { safe: true };
  } catch (error) {
    span.recordException(error as Error);
    console.error("Google Safe Browsing API connection error:", error);
    return { safe: true };
  } finally {
    span.end();
  }
  });
}
