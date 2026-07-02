import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cv — force a download of the CV.
 *
 * The PDF lives on the portfolio domain, and a browser ignores the `download` attribute on a
 * cross-origin link (it just opens the file instead). Proxying it through this same-origin route and
 * setting Content-Disposition: attachment makes the button actually download, while keeping the
 * portfolio site as the single source of truth for the file.
 */
const CV_URL = "https://portfolio.ivettadashkova.com/IvettaDashkova_Resume.pdf";
const FILENAME = "IvettaDashkova_Resume.pdf";

export async function GET() {
  try {
    const upstream = await fetch(CV_URL, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json({ error: "CV is temporarily unavailable." }, { status: 502 });
    }
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${FILENAME}"`,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch the CV." }, { status: 502 });
  }
}
