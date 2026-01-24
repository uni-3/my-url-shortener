/**
 * URLを正規化します。
 * 以下の処理を行います：
 * 1. ホスト名の小文字化、プロトコルの正規化、ドメイン末尾のスラッシュ付与（new URL()の標準動作）
 * 2. パス末尾の "/index.html" の削除
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
    return u.href;
  } catch {
    // URLが無効な場合はそのまま返す（バリデーションで弾かれるはずだが、念のため）
    return url;
  }
}
