import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Locus — Navigation Lab";

export default function Image() {
  return renderOgCard("lab");
}
