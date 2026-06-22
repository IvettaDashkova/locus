import { redirect } from "next/navigation";

// The shell opens on the first module. Modules live under the (modules) route group.
export default function Home() {
  redirect("/capture");
}
