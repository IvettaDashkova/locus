import { structuredData } from "@/lib/seo";

/**
 * Emits the site-wide Schema.org JSON-LD. Rendered once in the root layout. Server component — the
 * JSON is inlined at render time (no client JS). `dangerouslySetInnerHTML` is safe here: the content
 * is our own static, JSON-serialized object, not user input.
 */
export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }}
    />
  );
}
