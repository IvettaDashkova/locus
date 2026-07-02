import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: { absolute: "Ivetta Dashkova — Front End / Full Stack Developer" },
  description:
    "Ivetta Dashkova — frontend-focused full-stack developer (React, Next.js, TypeScript) with deep expertise in interactive maps and geospatial software. Explore Locus, my AI-orchestrated geospatial workspace.",
};

/**
 * The public front door. Signed-out visitors get the landing page (who I am + what Locus is, with a
 * way in and a feedback form); signed-in users skip straight to the first module.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/capture");
  return <LandingPage />;
}
