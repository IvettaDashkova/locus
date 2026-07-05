import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { JsonLd } from "@/components/seo/json-ld";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://locus-dun.vercel.app";
const DESCRIPTION =
  "An AI-orchestrated geospatial workspace by Ivetta Dashkova — four AI-driven modules over one shared map (Capture, Ask, Act, Tracks), plus a live Navigation Lab of common map problems and their fixes. Built on Next.js, PostGIS and pgvector.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Locus — geospatial workspace by Ivetta Dashkova",
    template: "%s — Locus",
  },
  description: DESCRIPTION,
  applicationName: "Locus",
  authors: [{ name: "Ivetta Dashkova", url: "https://portfolio.ivettadashkova.com/" }],
  creator: "Ivetta Dashkova",
  keywords: [
    "geospatial", "maps", "MapLibre", "PostGIS", "pgvector", "Next.js", "React", "TypeScript",
    "RAG", "AI agent", "GPS tracks", "GIS", "portfolio", "Ivetta Dashkova",
  ],
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  category: "technology",
  appleWebApp: { capable: true, title: "Locus", statusBarStyle: "black-translucent" },
  // Google Search Console ownership (HTML-tag method). Public token; env can override per-deploy.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION ?? "FtB09ylEgeZTBM2OX5YhmS0WRtqoU6w67aaJuGluKmo",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Locus",
    locale: "en_US",
    alternateLocale: ["uk_UA", "pl_PL"],
    title: "Locus — geospatial workspace by Ivetta Dashkova",
    description: DESCRIPTION,
    images: [{ url: "/ivetta.jpg", width: 1017, height: 1280, alt: "Ivetta Dashkova" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Locus — geospatial workspace by Ivetta Dashkova",
    description: DESCRIPTION,
    images: ["/ivetta.jpg"],
  },
};

/** Viewport + theme-color (split from `metadata` per the Next.js API). Dark-first, accent-tinted. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#6d4aff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <JsonLd />
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
