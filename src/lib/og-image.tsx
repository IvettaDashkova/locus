import { ImageResponse } from "next/og";
import { PAGES, type ModuleKey } from "./seo";

/** Landscape card that summary_large_image (X) and LinkedIn expect — replaces the portrait photo crop. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const ACCENT = "#6d4aff"; // matches the app's primary / route-builder accent

/**
 * Render a per-module OG card from the shared `PAGES` copy, so the share preview always matches the
 * page. `next/og` uses Satori: every element with more than one child needs an explicit
 * `display: flex`, and only a flexbox subset of CSS is supported.
 */
export function renderOgCard(key: ModuleKey): ImageResponse {
  const p = PAGES[key];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0a0a0f 0%, #14101f 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>LOCUS</div>
        </div>

        {/* Module name + tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05 }}>{p.name}</div>
          <div style={{ display: "flex", fontSize: 38, color: "#b4b4c4", lineHeight: 1.2 }}>
            {p.tagline}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: "#8a8a9a",
          }}
        >
          <div style={{ display: "flex" }}>locus-dun.vercel.app</div>
          <div style={{ display: "flex", color: ACCENT, fontWeight: 600 }}>Ivetta Dashkova</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
