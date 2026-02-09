/**
 * URLを正規化します。
 * 以下の処理を行います：
 * 1. ホスト名の小文字化、プロトコルの正規化、ドメイン末尾のスラッシュ付与（new URL()の標準動作）
 * 2. パス末尾の "/index.html" の削除
 * 3. パス末尾をスラッシュありに統一（ファイル名のように見えるパスを除く）
 *
 * @param url 正規化するURL文字列
 * @returns 正規化されたURL文字列
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.pathname.endsWith("/index.html")) {
      u.pathname = u.pathname.slice(0, -10);
    }

    const lastSegment = u.pathname.split("/").pop() || "";
    // パス末尾をスラッシュありに統一（ドットを含む「ファイル名」のようなパスは除外）
    if (!u.pathname.endsWith("/") && !lastSegment.includes(".")) {
      u.pathname += "/";
    }
    return u.href;
  } catch {
    return url;
  }
}
