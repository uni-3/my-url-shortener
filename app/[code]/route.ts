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

  try {
    const entry = await db.query.urls.findFirst({
      where: eq(urls.shortCode, code),
    });

    if (!entry) {
      notFound();
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
