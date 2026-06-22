/** v1 API (POST/GET/DELETE /api/v1/links) を叩く CLI 用クライアント。 */

export interface ClientConfig {
  baseUrl: string;
  apiKey: string;
}

export interface Link {
  code: string;
  short_url: string;
  long_url: string;
}

/** v1 API がエラーレスポンスを返したときに投げられる。 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(
  config: ClientConfig,
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
): Promise<Response> {
  return fetch(new URL(path, config.baseUrl), {
    method: init.method,
    headers: { ...init.headers, Authorization: `Bearer ${config.apiKey}` },
    body: init.body,
  });
}

/** エラーレスポンスから API のメッセージを取り出し ApiError として投げる。 */
async function fail(response: Response): Promise<never> {
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) message = body.error.message;
  } catch {
    // JSON でないボディはステータスコードのみで表現する
  }
  throw new ApiError(response.status, message);
}

export async function createLink(config: ClientConfig, url: string): Promise<Link> {
  const response = await request(config, "/api/v1/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) await fail(response);
  return (await response.json()) as Link;
}

export async function getLink(config: ClientConfig, code: string): Promise<Link> {
  const response = await request(config, `/api/v1/links/${encodeURIComponent(code)}`, {
    method: "GET",
  });
  if (!response.ok) await fail(response);
  return (await response.json()) as Link;
}

export async function deleteLink(config: ClientConfig, code: string): Promise<void> {
  const response = await request(config, `/api/v1/links/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
  if (!response.ok) await fail(response);
}
