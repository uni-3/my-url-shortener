import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppEnv } from "@/db";
import { buildService } from "@/lib/core/build";
import { ShortenError } from "@/lib/core/errors";
import { linkPayload } from "@/lib/api/responses";
import { verifyApiKey } from "@/lib/api/api-key";
import { enforceApiRateLimit } from "@/lib/api/rate-limit";
import { setUserAttributes } from "@/lib/utils/telemetry";
import { ensureOtelInitialized, scheduleOtelFlush } from "@/lib/otel/init";

const tracer = trace.getTracer("url-shortener");

type WaitUntilCtx = { waitUntil: (p: Promise<unknown>) => void };
type Variables = { env: AppEnv; ctx: WaitUntilCtx };

// ---- スキーマ（バリデーション = OpenAPIスキーマの単一定義。ここがズレない源） ----

const LinkSchema = z
  .object({
    code: z.string().openapi({ description: "短縮コード", example: "abc123" }),
    short_url: z
      .string()
      .url()
      .openapi({ description: "短縮 URL", example: "https://s.uni-3.app/abc123" }),
    long_url: z
      .string()
      .url()
      .openapi({ description: "元の URL", example: "https://example.com/very/long/path" }),
  })
  .openapi("Link");

const ErrorSchema = z
  .object({
    error: z.object({
      message: z.string().openapi({ example: "APIキーが無効です" }),
    }),
  })
  .openapi("Error");

const UnsafeUrlErrorSchema = z
  .object({
    error: z.object({
      message: z
        .string()
        .openapi({ example: "このURLは安全ではない可能性があるため登録できません" }),
      threatType: z
        .string()
        .optional()
        .openapi({ description: "Google Safe Browsing が検出した脅威の種別", example: "MALWARE" }),
    }),
  })
  .openapi("UnsafeUrlError");

const CreateLinkBody = z
  .object({
    url: z
      .string()
      .url({ message: "https://から始まるURLを入力してください" })
      .openapi({ description: "短縮する URL（http / https）", example: "https://example.com/very/long/path" }),
  })
  .openapi("CreateLinkBody");

const CodeParam = z.object({
  code: z.string().openapi({ param: { name: "code", in: "path" }, example: "abc123" }),
});

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  "application/json": { schema },
});

// ---- アプリ本体 ----

export const v1App = new OpenAPIHono<{ Variables: Variables }>({
  // Zod バリデーション失敗時は共通のエラー形 { error: { message } } で返す。
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "リクエストが不正です";
      return c.json({ error: { message } }, 400);
    }
  },
});

v1App.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "APIキー。`Authorization: Bearer <API_KEY>` ヘッダーで送信。",
});

// OTel: リクエスト全体を1つのスパンで包む（既存ルートの startActiveSpan 相当）。
v1App.use("*", async (c, next) => {
  const { env, ctx } = (await getCloudflareContext()) as unknown as {
    env: AppEnv;
    ctx: WaitUntilCtx;
  };
  ensureOtelInitialized(env);
  c.set("env", env);
  c.set("ctx", ctx);

  await tracer.startActiveSpan(`api-v1 ${c.req.method} ${c.req.path}`, async (span) => {
    try {
      await setUserAttributes(span, c.req.raw, env);
      await next();
      const status = c.res.status;
      span.setStatus(
        status >= 400
          ? { code: SpanStatusCode.ERROR, message: `HTTP ${status}` }
          : { code: SpanStatusCode.OK },
      );
    } finally {
      span.end();
      scheduleOtelFlush(ctx);
    }
  });
});

// 認証 → レート制限。OTelスパンの内側で動かしてトレースに含める。
v1App.use("*", async (c, next) => {
  const env = c.get("env");
  if (!verifyApiKey(c.req.raw, env.API_KEY)) {
    return c.json({ error: { message: "APIキーが無効です" } }, 401);
  }
  const limited = await enforceApiRateLimit(env);
  if (limited) return limited;
  await next();
});

v1App.onError((err, c) => {
  // 不正なJSONボディは json バリデータが HTTPException(400) として投げる。
  // 既定の onError は 500 にしてしまうため、共通のエラー形に正規化する。
  if (err instanceof HTTPException) {
    const message = err.status === 400 ? "リクエストボディが不正なJSONです" : err.message;
    return c.json({ error: { message } }, err.status);
  }
  trace.getActiveSpan()?.recordException(err as Error);
  console.error("API v1 error:", err);
  return c.json({ error: { message: "リクエストの処理に失敗しました" } }, 500);
});

// ---- ルート定義（createRoute にハンドラを登録 = ルート/バリデーション/specが同一） ----

const rateLimitResponse = {
  429: {
    description: "レート制限超過（60 リクエスト / 分）",
    content: jsonContent(ErrorSchema),
  },
  500: { description: "サーバーエラー", content: jsonContent(ErrorSchema) },
} as const;

const createLinkRoute = createRoute({
  method: "post",
  path: "/api/v1/links",
  operationId: "createLink",
  summary: "URL を短縮する",
  description:
    "指定した URL を短縮します。既に登録済みの URL は既存の短縮コードを `200` で返します（新規は `201`）。",
  tags: ["Links"],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: jsonContent(CreateLinkBody) } },
  responses: {
    201: { description: "新規作成", content: jsonContent(LinkSchema) },
    200: { description: "既存の短縮 URL（重複登録）", content: jsonContent(LinkSchema) },
    400: { description: "リクエストが不正（URL 形式エラーなど）", content: jsonContent(ErrorSchema) },
    401: { description: "APIキーが無効", content: jsonContent(ErrorSchema) },
    403: {
      description: "安全でない URL のため登録不可（Google Safe Browsing）",
      content: jsonContent(UnsafeUrlErrorSchema),
    },
    ...rateLimitResponse,
  },
});

v1App.openapi(createLinkRoute, async (c) => {
  const env = c.get("env");
  const { url } = c.req.valid("json");
  const origin = new URL(c.req.url).origin;
  try {
    const { record, isExisting } = await buildService(env).create(url);
    return c.json(linkPayload(origin, record), isExisting ? 200 : 201);
  } catch (error) {
    if (error instanceof ShortenError && error.code === "UNSAFE_URL") {
      return c.json(
        {
          error: {
            message: "このURLは安全ではない可能性があるため登録できません",
            threatType: error.detail?.threatType as string | undefined,
          },
        },
        403,
      );
    }
    throw error;
  }
});

const getLinkRoute = createRoute({
  method: "get",
  path: "/api/v1/links/{code}",
  operationId: "getLink",
  summary: "短縮 URL の詳細を取得する",
  description: "短縮コードに対応する URL の詳細情報を取得します。",
  tags: ["Links"],
  security: [{ bearerAuth: [] }],
  request: { params: CodeParam },
  responses: {
    200: { description: "リンク情報", content: jsonContent(LinkSchema) },
    401: { description: "APIキーが無効", content: jsonContent(ErrorSchema) },
    404: { description: "指定されたコードが存在しない", content: jsonContent(ErrorSchema) },
    ...rateLimitResponse,
  },
});

v1App.openapi(getLinkRoute, async (c) => {
  const env = c.get("env");
  const { code } = c.req.valid("param");
  const record = await buildService(env).get(code);
  if (!record) {
    return c.json({ error: { message: "指定された短縮コードは存在しません" } }, 404);
  }
  return c.json(linkPayload(new URL(c.req.url).origin, record), 200);
});

const deleteLinkRoute = createRoute({
  method: "delete",
  path: "/api/v1/links/{code}",
  operationId: "deleteLink",
  summary: "短縮 URL を削除する",
  description: "短縮コードに対応する URL を削除します。KV キャッシュも同時にクリアされます。",
  tags: ["Links"],
  security: [{ bearerAuth: [] }],
  request: { params: CodeParam },
  responses: {
    204: { description: "削除成功" },
    401: { description: "APIキーが無効", content: jsonContent(ErrorSchema) },
    404: { description: "指定されたコードが存在しない", content: jsonContent(ErrorSchema) },
    ...rateLimitResponse,
  },
});

v1App.openapi(deleteLinkRoute, async (c) => {
  const env = c.get("env");
  const { code } = c.req.valid("param");
  const deleted = await buildService(env).delete(code);
  if (!deleted) {
    return c.json({ error: { message: "指定された短縮コードは存在しません" } }, 404);
  }
  // 削除後もキャッシュが残ると最大1日リダイレクトし続けるため消去する。
  const KV = env.URL_CACHE;
  if (KV) await KV.delete(code);
  return c.body(null, 204);
});

// ---- OpenAPI ドキュメント生成 ----
//
// v1 のパスは上の createRoute から自動生成されるためコードとズレない。
// リダイレクト (/{code}) と MCP (/mcp) は Hono 管理外なので、参考として手動登録する
// （これらは契約が固定で変化しないため手動でも実害がない）。

v1App.openAPIRegistry.registerPath({
  method: "get",
  path: "/{code}",
  operationId: "redirect",
  summary: "短縮 URL へリダイレクト",
  description:
    "短縮コードに対応する元の URL へ `302` リダイレクトします。認証不要。Cloudflare KV でキャッシュされます。",
  tags: ["Redirect"],
  security: [],
  request: { params: CodeParam },
  responses: {
    302: {
      description: "元の URL へリダイレクト",
      headers: z.object({
        Location: z.string().url().openapi({ description: "リダイレクト先 URL" }),
      }),
    },
    404: { description: "指定されたコードが存在しない" },
  },
});

export function getOpenApiDocument() {
  return v1App.getOpenAPIDocument({
    openapi: "3.1.0",
    info: {
      title: "URL短縮サービス API",
      description: [
        "URL短縮・解決のための REST API。",
        "",
        "## 認証",
        "",
        "すべての `/api/v1/` エンドポイントには API キーが必要です。",
        "",
        "```",
        "Authorization: Bearer <API_KEY>",
        "```",
        "",
        "## レート制限",
        "",
        "API キー単位で 60 リクエスト / 分。`Retry-After` ヘッダーに次の待機秒数が含まれます。",
        "",
        "## MCP",
        "",
        "AIエージェント向けに `/mcp`（Streamable HTTP, APIキー認証）も提供しています。詳細は README を参照。",
      ].join("\n"),
      version: "1.0.0",
      license: { name: "MIT" },
    },
    servers: [
      { url: "/", description: "現在の環境（相対パス）" },
      { url: "https://s.uni-3.app", description: "本番環境" },
    ],
    security: [{ bearerAuth: [] }],
  });
}
