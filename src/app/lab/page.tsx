import type { Metadata } from "next";
import { LabPage } from "@/components/lab/lab-page";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("lab");

export default function Lab() {
  return <LabPage />;
}
