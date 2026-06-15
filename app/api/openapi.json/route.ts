import { NextResponse } from "next/server";
import { generateOpenApiSpec } from "@/lib/openapi/spec";

export async function GET() {
  return NextResponse.json(generateOpenApiSpec());
}
