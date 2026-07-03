import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Locus — Capture";

export default function Image() {
  return renderOgCard("capture");
}
