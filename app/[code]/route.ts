import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { urls } from "@/db/schema/urls";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // KV Binding
  const KV = (process.env as any).URL_CACHE as KVNamespace;

  try {
    // 1. キャッシュを確認
    if (KV) {
      const cachedUrl = await KV.get(code);
      if (cachedUrl) {
        return NextResponse.redirect(cachedUrl, 302);
      }
    }

    // 2. キャッシュミスの場合、DBを確認
    const entry = await db.query.urls.findFirst({
      where: eq(urls.shortCode, code),
    });

    if (!entry) {
      notFound();
    }

    // 3. キャッシュを更新 (有効期限1日)
    if (KV) {
      await KV.put(code, entry.longUrl, { expirationTtl: 86400 });
    }

    return NextResponse.redirect(entry.longUrl, 302);
  } catch (error: any) {
    if (error.digest === "NEXT_NOT_FOUND") {
      throw error;
    }
    console.error("Redirect error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
