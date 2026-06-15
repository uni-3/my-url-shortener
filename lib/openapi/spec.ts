import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// ---- Security ----

const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "APIキー。`Authorization: Bearer <API_KEY>` ヘッダーで送信。",
});

// ---- Schemas ----

const LinkSchema = registry.register(
  "Link",
  z.object({
    code: z.string().openapi({ description: "短縮コード", example: "abc123" }),
    short_url: z
      .string()
      .url()
      .openapi({ description: "短縮 URL", example: "https://s.uni-3.app/abc123" }),
    long_url: z
      .string()
      .url()
      .openapi({ description: "元の URL", example: "https://example.com/very/long/path" }),
  }),
);

const ErrorSchema = registry.register(
  "Error",
  z.object({
    error: z.object({
      message: z.string().openapi({ example: "APIキーが無効です" }),
    }),
  }),
);

const UnsafeUrlErrorSchema = registry.register(
  "UnsafeUrlError",
  z.object({
    error: z.object({
      message: z.string().openapi({ example: "このURLは安全ではない可能性があるため登録できません" }),
      threatType: z
        .string()
        .optional()
        .openapi({ description: "Google Safe Browsing が検出した脅威の種別", example: "MALWARE" }),
    }),
  }),
);

// ---- Common response components ----

const codeParam = z.string().openapi({ param: { name: "code", in: "path" }, example: "abc123" });

const rateLimitResponses = {
  429: {
    description: "レート制限超過（60 リクエスト / 分）",
    headers: {
      "Retry-After": {
        schema: { type: "integer" as const },
        description: "次のリクエストまでの待機秒数",
      },
    },
    content: { "application/json": { schema: ErrorSchema } },
  },
  500: {
    description: "サーバーエラー",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

// ---- Paths ----

registry.registerPath({
  method: "get",
  path: "/{code}",
  operationId: "redirect",
  summary: "短縮 URL へリダイレクト",
  description:
    "短縮コードに対応する元の URL へ `302` リダイレクトします。認証不要。Cloudflare KV でキャッシュされます。",
  tags: ["Redirect"],
  security: [],
  request: { params: z.object({ code: codeParam }) },
  responses: {
    302: {
      description: "元の URL へリダイレクト",
      headers: {
        Location: {
          schema: { type: "string", format: "uri" },
          description: "リダイレクト先 URL",
        },
      },
    },
    404: { description: "指定されたコードが存在しない" },
    500: { description: "サーバーエラー" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/links",
  operationId: "createLink",
  summary: "URL を短縮する",
  description:
    "指定した URL を短縮します。既に登録済みの URL は既存の短縮コードを `200` で返します（新規は `201`）。",
  tags: ["Links"],
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            url: z
              .string()
              .url()
              .openapi({ description: "短縮する URL（http / https）", example: "https://example.com/very/long/path" }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "新規作成", content: { "application/json": { schema: LinkSchema } } },
    200: { description: "既存の短縮 URL（重複登録）", content: { "application/json": { schema: LinkSchema } } },
    400: {
      description: "リクエストが不正（URL 形式エラーなど）",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: { description: "APIキーが無効", content: { "application/json": { schema: ErrorSchema } } },
    403: {
      description: "安全でない URL のため登録不可（Google Safe Browsing）",
      content: { "application/json": { schema: UnsafeUrlErrorSchema } },
    },
    ...rateLimitResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/links/{code}",
  operationId: "getLink",
  summary: "短縮 URL の詳細を取得する",
  description: "短縮コードに対応する URL の詳細情報を取得します。",
  tags: ["Links"],
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ code: codeParam }) },
  responses: {
    200: { description: "リンク情報", content: { "application/json": { schema: LinkSchema } } },
    401: { description: "APIキーが無効", content: { "application/json": { schema: ErrorSchema } } },
    404: {
      description: "指定されたコードが存在しない",
      content: { "application/json": { schema: ErrorSchema } },
    },
    ...rateLimitResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/links/{code}",
  operationId: "deleteLink",
  summary: "短縮 URL を削除する",
  description: "短縮コードに対応する URL を削除します。KV キャッシュも同時にクリアされます。",
  tags: ["Links"],
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ code: codeParam }) },
  responses: {
    204: { description: "削除成功" },
    401: { description: "APIキーが無効", content: { "application/json": { schema: ErrorSchema } } },
    404: {
      description: "指定されたコードが存在しない",
      content: { "application/json": { schema: ErrorSchema } },
    },
    ...rateLimitResponses,
  },
});

// ---- Generator ----

let cachedSpec: ReturnType<OpenApiGeneratorV31["generateDocument"]> | null = null;

export function generateOpenApiSpec() {
  if (cachedSpec) return cachedSpec;
  cachedSpec = new OpenApiGeneratorV31(registry.definitions).generateDocument({
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
  return cachedSpec;
}
