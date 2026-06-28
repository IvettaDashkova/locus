import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/openapi";

export const dynamic = "force-static";

/** GET → the OpenAPI 3.0 document for the Locus API (consumed by Swagger UI at /api/docs). */
export function GET() {
  return NextResponse.json(openapiSpec);
}
