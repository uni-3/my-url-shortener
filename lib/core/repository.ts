import { eq } from "drizzle-orm";
import type { DbClient } from "@/db";
import { urls } from "@/db/schema/urls";
import { CodeCollisionError } from "./errors";

export interface UrlRecord {
  id: number;
  longUrl: string;
  shortCode: string;
  createdAt: string;
}

export interface UrlRepository {
  findByLongUrl(longUrl: string): Promise<UrlRecord | null>;
  findByCode(code: string): Promise<UrlRecord | null>;
  create(longUrl: string, shortCode: string): Promise<UrlRecord>;
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

  async create(longUrl: string, shortCode: string): Promise<UrlRecord> {
    try {
      const [inserted] = await this.db
        .insert(urls)
        .values({ longUrl, shortCode })
        .returning();
      return inserted;
    } catch (error) {
      // short_code の UNIQUE 制約違反は衝突として扱い、呼び出し側に再試行させる
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw new CodeCollisionError(shortCode);
      }
      throw error;
    }
  }

  async deleteByCode(code: string): Promise<boolean> {
    const deleted = await this.db
      .delete(urls)
      .where(eq(urls.shortCode, code))
      .returning({ id: urls.id });
    return deleted.length > 0;
  }
}
