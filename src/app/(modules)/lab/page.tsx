import type { Metadata } from "next";
import { LabPage } from "@/components/lab/lab-page";

export const metadata: Metadata = {
  title: "Navigation Lab",
  description:
    "Seven common map & navigation problems shown live, in plain language, each with the fix and its business impact — GPS smoothing, coordinate order, the antimeridian, distance accuracy, track simplification, marker clustering, and shareable map state.",
};

export default function Lab() {
  return <LabPage />;
}
