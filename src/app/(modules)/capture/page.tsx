import type { Metadata } from "next";
import { CaptureWorkspace } from "@/components/capture/capture-workspace";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata("capture");

export default function CapturePage() {
  return <CaptureWorkspace />;
}
