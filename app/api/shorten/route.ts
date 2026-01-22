import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Sqids from "sqids";

const sqids = new Sqids();

const URLSchema = z.object({
  url: z.string().url("有効なURLを入力してください"),
});

// 簡易的なメモリストレージ（本番環境ではDBを使用）
const urlStore = new Map<string, string>();
let idCounter = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = URLSchema.parse(body);

    // 既存のURLをチェック
    for (const [id, storedUrl] of urlStore) {
      if (storedUrl === url) {
        return NextResponse.json(
          { shortCode: sqids.encode([parseInt(id)]) },
          { status: 200 }
        );
      }
    }

    // 新しいIDを生成
    const id = idCounter++;
    urlStore.set(String(id), url);

    const shortCode = sqids.encode([id]);

    return NextResponse.json(
      { shortCode, url },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "URLの短縮に失敗しました" },
      { status: 500 }
    );
  }
}
