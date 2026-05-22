import { eq } from "drizzle-orm";
import type { DbClient } from "@/db";
import { urls } from "@/db/schema/urls";
import { generateRandomString } from "@/lib/utils/random";

export interface UrlRecord {
  id: number;
  longUrl: string;
  shortCode: string;
  createdAt: string;
}

export interface UrlRepository {
  findByLongUrl(longUrl: string): Promise<UrlRecord | null>;
  findByCode(code: string): Promise<UrlRecord | null>;
  create(longUrl: string, deriveCode: (id: number) => string): Promise<UrlRecord>;
  deleteByCode(code: string): Promise<boolean>;
}

export class D1UrlRepository implements UrlRepository {
  constructor(private readonly db: DbClient) {}

  async findByLongUrl(longUrl: string): Promise<UrlRecord | null> {
    const row = await this.db.query.urls.findFirst({ where: eq(urls.longUrl, longUrl) });
    return row ?? null;
  }

  async findByCode(code: string): Promise<UrlRecord | null> {
    const row = await this.db.query.urls.findFirst({ where: eq(urls.shortCode, code) });
    return row ?? null;
  }

  // 短縮コードは行のIDから導出するため、一時コードで挿入してからIDで更新する。
  // D1 は BEGIN/COMMIT による対話的トランザクションを持たないため個別に実行する。
  async create(longUrl: string, deriveCode: (id: number) => string): Promise<UrlRecord> {
    const tmpCode = `tmp-${Date.now()}-${generateRandomString(12)}`;
    const [inserted] = await this.db
      .insert(urls)
      .values({ longUrl, shortCode: tmpCode })
      .returning();
    const shortCode = deriveCode(inserted.id);
    await this.db.update(urls).set({ shortCode }).where(eq(urls.id, inserted.id));
    return { id: inserted.id, longUrl: inserted.longUrl, shortCode, createdAt: inserted.createdAt };
  }

  async deleteByCode(code: string): Promise<boolean> {
    const deleted = await this.db
      .delete(urls)
      .where(eq(urls.shortCode, code))
      .returning({ id: urls.id });
    return deleted.length > 0;
  }
}
