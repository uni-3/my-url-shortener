import { db } from "@/db";
import { urls } from "@/db/schema/urls";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const code = (await params).code;

  try {
    const result = await db.query.urls.findFirst({
      where: eq(urls.shortCode, code),
    });

    if (!result) {
      notFound();
    }

    // 302 リダイレクトを実行
    return NextResponse.redirect(new URL(result.longUrl), 302);
  } catch (error) {
    // notFound() が投げた場合はそのまま上に流す (Next.js が処理)
    if (error instanceof Error && error.message === "NEXT_NOT_FOUND") {
      throw error;
    }
    console.error("Redirect error:", error);
    return NextResponse.redirect(new URL("/", request.url), 302);
  }
}
