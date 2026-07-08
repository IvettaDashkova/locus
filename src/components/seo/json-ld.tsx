import { structuredData } from "@/lib/seo";

/**
 * Emits the site-wide Schema.org JSON-LD. Rendered once in the root layout. Server component — the
 * JSON is inlined at render time (no client JS). `dangerouslySetInnerHTML` is safe here: the content
 * is our own static, JSON-serialized object, not user input.
 */
export function JsonLd() {
  // Escape `<` so a value can never terminate the <script> early (defensive: the data is static
  // today, but this keeps it XSS-safe if the graph ever includes dynamic content).
  const json = JSON.stringify(structuredData()).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
