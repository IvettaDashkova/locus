import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/landing-page";

/**
 * The public front door. Signed-out visitors get the landing page (who I am + what Locus is, with a
 * way in and a feedback form); signed-in users skip straight to the first module.
 */
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/capture");
  return <LandingPage />;
}
