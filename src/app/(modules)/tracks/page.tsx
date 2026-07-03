import type { Metadata } from "next";
import { TracksWorkspace } from "@/components/tracks/tracks-workspace";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("tracks");

export default function TracksPage() {
  return <TracksWorkspace />;
}
