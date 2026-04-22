interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined
): Promise<TurnstileVerifyResponse> {
  if (!token || !secret) return { success: false, "error-codes": ["missing-input"] };

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });

  return res.json() as Promise<TurnstileVerifyResponse>;
}
