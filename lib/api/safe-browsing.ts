export async function checkUrlSafety(url: string): Promise<{ safe: boolean; threatType?: string }> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_SAFE_BROWSING_API_KEY is not set. Skipping safety check.");
    return { safe: true };
  }

  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client: {
          clientId: "my-url-shortener",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Google Safe Browsing API error:", response.status, errorData);
      // APIエラー時は安全とみなして続行（フェイルセーフ）
      return { safe: true };
    }

    const data = await response.json() as any;

    if (data.matches && data.matches.length > 0) {
      return {
        safe: false,
        threatType: data.matches[0].threatType,
      };
    }

    return { safe: true };
  } catch (error) {
    console.error("Google Safe Browsing API connection error:", error);
    return { safe: true };
  }
}
