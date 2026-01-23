import { NextRequest, NextResponse } from "next/server";
import { validateUrl } from "@/lib/validations/url";
import { encodeId } from "@/lib/utils/sqids";
import { db } from "@/db";
import { urls } from "@/db/schema/urls";
import { eq } from "drizzle-orm";
import { checkUrlSafety } from "@/lib/services/safe-browsing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = validateUrl(body.url);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { url } = result.data;

    // 安全確認 (Issue #11)
    const isSafe = await checkUrlSafety(url);
    if (!isSafe) {
      return NextResponse.json(
        { error: "指定されたURLは安全ではない可能性があるため、短縮できません" },
        { status: 400 }
      );
    }

    // 既存のURLをチェック (Issue #10)
    const existing = await db.query.urls.findFirst({
      where: eq(urls.longUrl, url),
    });

    if (existing) {
      return NextResponse.json(
        { shortCode: existing.shortCode },
        { status: 200 }
      );
    }

    // 新しいURLを登録 (Issue #10)
    const shortCode = await db.transaction(async (tx) => {
      // 一時的なコードで挿入してIDを取得
      const [inserted] = await tx
        .insert(urls)
        .values({
          longUrl: url,
          shortCode: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        })
        .returning({ id: urls.id });

      const code = encodeId(inserted.id);

      // 実際の短縮コードで更新
      await tx
        .update(urls)
        .set({ shortCode: code })
        .where(eq(urls.id, inserted.id));

      return code;
    });

    return NextResponse.json(
      { shortCode, url },
      { status: 201 }
    );
  } catch (error) {
    console.error("URL shortening error:", error);
    return NextResponse.json(
      { error: "URLの短縮に失敗しました" },
      { status: 500 }
    );
  }
}
