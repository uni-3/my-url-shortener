import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, createLink, deleteLink, getLink } from "@/cli/client";

const config = { baseUrl: "https://sho.rt", apiKey: "test-key" };
const link = { code: "abc", short_url: "https://sho.rt/abc", long_url: "https://example.com/" };

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function stubFetch(response: Response) {
  const mock = vi.fn(async (_url: URL, _init: RequestInit) => response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cli client", () => {
  it("createLink posts the url with the bearer token", async () => {
    const fetchMock = stubFetch(jsonResponse(201, link));
    const result = await createLink(config, "https://example.com");

    expect(result).toEqual(link);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("https://sho.rt/api/v1/links");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com" });
  });

  it("getLink requests the percent-encoded code", async () => {
    const fetchMock = stubFetch(jsonResponse(200, link));
    const result = await getLink(config, "a/b");

    expect(result).toEqual(link);
    expect(fetchMock.mock.calls[0][0].toString()).toBe("https://sho.rt/api/v1/links/a%2Fb");
  });

  it("deleteLink resolves on a 204 response", async () => {
    const fetchMock = stubFetch({ ok: true, status: 204 } as Response);

    await expect(deleteLink(config, "abc")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("throws ApiError carrying the server message", async () => {
    stubFetch(jsonResponse(404, { error: { message: "見つかりません" } }));
    const error = await getLink(config, "missing").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("見つかりません");
  });

  it("falls back to the status code for a non-JSON error body", async () => {
    stubFetch({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("invalid json");
      },
    } as unknown as Response);
    const error = await createLink(config, "https://example.com").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("HTTP 502");
  });
});
