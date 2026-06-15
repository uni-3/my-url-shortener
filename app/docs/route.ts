import { NextResponse } from "next/server";

/** Scalar CDN を使った API リファレンスページ */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>URL短縮サービス API リファレンス</title>
  <style>body { margin: 0; }</style>
</head>
<body>
  <script
    id="api-reference"
    data-url="/api/openapi.json"
    data-configuration='{"theme":"default"}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1"></script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
