import { normalizeUrl } from "@/lib/utils/url";
import { CodeCollisionError, ShortenError } from "./errors";
import type { IdGenerator } from "./id-generator";
import type { UrlRecord, UrlRepository } from "./repository";

export type SafetyChecker = (url: string) => Promise<{ safe: boolean; threatType?: string }>;

export interface CreateResult {
  record: UrlRecord;
  isExisting: boolean;
}

const MAX_CODE_ATTEMPTS = 5;

/** URL短縮のコアロジック。依存はコンストラクタDIで受け取り、メソッド内で new しない。 */
export class ShortenService {
  constructor(
    private readonly repo: UrlRepository,
    private readonly idGenerator: IdGenerator,
    private readonly checkSafety: SafetyChecker,
  ) {}

  async create(rawUrl: string): Promise<CreateResult> {
    const url = normalizeUrl(rawUrl);

    const existing = await this.repo.findByLongUrl(url);
    if (existing) {
      return { record: existing, isExisting: true };
    }

    const safety = await this.checkSafety(url);
    if (!safety.safe) {
      throw new ShortenError("UNSAFE_URL", "このURLは安全ではない可能性があります", {
        threatType: safety.threatType,
      });
    }

    return { record: await this.insertWithUniqueCode(url), isExisting: false };
  }

  async get(code: string): Promise<UrlRecord | null> {
    return this.repo.findByCode(code);
  }

  async delete(code: string): Promise<boolean> {
    return this.repo.deleteByCode(code);
  }

  // コードはランダム生成のため極稀に衝突する。別コードで数回まで再試行する。
  private async insertWithUniqueCode(url: string): Promise<UrlRecord> {
    let lastError: CodeCollisionError | undefined;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.repo.create(url, this.idGenerator.generate());
      } catch (error) {
        if (!(error instanceof CodeCollisionError)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }
}
