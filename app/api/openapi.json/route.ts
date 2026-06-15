import { NextResponse } from "next/server";
import { getOpenApiDocument } from "@/lib/api/v1/app";

export function GET() {
  return NextResponse.json(getOpenApiDocument());
}
