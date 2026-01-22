import { NextResponse } from "next/server";
import Sqids from "sqids";

const sqids = new Sqids();

// 簡易的なメモリストレージ（本番環境ではDBを使用）
const urlStore = new Map<string, string>();

export async function GET(
  _request: unknown,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // コードをデコード
    const ids = sqids.decode(code);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid short code" },
        { status: 404 }
      );
    }

    const id = ids[0];
    const originalUrl = urlStore.get(String(id));

    if (!originalUrl) {
      return NextResponse.json(
        { error: "Short code not found" },
        { status: 404 }
      );
    }

    // 302 一時リダイレクト
    return NextResponse.redirect(originalUrl, { status: 302 });
  } catch (error) {
    return NextResponse.json(
      { error: "リダイレクトに失敗しました" },
      { status: 500 }
    );
  }
}
