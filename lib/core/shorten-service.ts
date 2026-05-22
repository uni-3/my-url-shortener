import { normalizeUrl } from "@/lib/utils/url";
import { ShortenError } from "./errors";
import type { IdGenerator } from "./id-generator";
import type { UrlRecord, UrlRepository } from "./repository";

export type SafetyChecker = (url: string) => Promise<{ safe: boolean; threatType?: string }>;

export interface CreateResult {
  record: UrlRecord;
  isExisting: boolean;
}

/**
 * URL短縮のコアロジック。HTTP/CLIなどのインターフェースから利用される主役。
 * 依存はコンストラクタで受け取り、メソッド内で new しない。
 */
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

    const record = await this.repo.create(url, (id) => this.idGenerator.encode(id));
    return { record, isExisting: false };
  }

  async get(code: string): Promise<UrlRecord | null> {
    return this.repo.findByCode(code);
  }

  async delete(code: string): Promise<boolean> {
    return this.repo.deleteByCode(code);
  }
}
