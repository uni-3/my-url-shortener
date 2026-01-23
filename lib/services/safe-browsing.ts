/**
 * Google Safe Browsing API を使用して URL の安全性を確認するサービス
 */
export async function checkUrlSafety(url: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey) {
    console.warn(
      "GOOGLE_SAFE_BROWSING_API_KEY が設定されていません。安全確認をスキップします。"
    );
    return true;
  }

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
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
      }
    );

    if (!response.ok) {
      throw new Error(`Safe Browsing API responded with ${response.status}`);
    }

    const data = await response.json();

    // matches が存在する場合は危険なURLとみなす
    return !data.matches || data.matches.length === 0;
  } catch (error) {
    console.error("Safe Browsing API check failed:", error);
    // API エラーの場合は安全とみなして続行する (Fail-open)
    return true;
  }
}
