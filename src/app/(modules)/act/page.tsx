import type { Metadata } from "next";
import { ActWorkspace } from "@/components/act/act-workspace";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("act");

export default function ActPage() {
  return <ActWorkspace />;
}
