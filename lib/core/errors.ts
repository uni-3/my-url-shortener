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
