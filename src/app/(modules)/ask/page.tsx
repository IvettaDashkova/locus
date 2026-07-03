import type { Metadata } from "next";
import { AskWorkspace } from "@/components/ask/ask-workspace";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("ask");

export default function AskPage() {
  return <AskWorkspace />;
}
