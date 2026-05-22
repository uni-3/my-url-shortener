export type ShortenErrorCode = "UNSAFE_URL";

/** コアロジックが返す業務エラー。インターフェース層で構造化レスポンスへ変換する。 */
export class ShortenError extends Error {
  constructor(
    public readonly code: ShortenErrorCode,
    message: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ShortenError";
  }
}

/** 生成した短縮コードが既存と衝突したことを示す。サービス層が別コードで再試行する。 */
export class CodeCollisionError extends Error {
  constructor(public readonly shortCode: string) {
    super(`Short code already exists: ${shortCode}`);
    this.name = "CodeCollisionError";
  }
}
