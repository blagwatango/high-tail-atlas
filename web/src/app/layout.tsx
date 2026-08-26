import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { CaveatBanner } from "@/components/CaveatBanner";
import { SkipLinks } from "@/components/SkipLinks";
import "./globals.css";

const TITLE =
  "High-Tail Atlas — modeled estimates of the population share at IQ ≥ 130";
const DESCRIPTION =
  "Modeled estimates of the share of each country’s population at IQ ≥ 130. These are modeled estimates, not measurements or a ranking of nations.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
  ),
  title: TITLE,
  description: DESCRIPTION,
  robots: "noindex,nofollow",
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "High-Tail Atlas caveat: modeled estimates, not measurements. Not a ranking of people, nations, or worth.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <NuqsAdapter>
          <SkipLinks />
          <header className="border-b border-stone-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-4 px-4 py-3">
              <Link href="/" className="font-semibold tracking-tight">
                High-Tail Atlas
              </Link>
              <nav className="flex gap-4 text-sm text-stone-700">
                <Link
                  href="/about/"
                  className="underline-offset-2 hover:underline"
                >
                  About
                </Link>
                <Link
                  href="/methodology/"
                  className="underline-offset-2 hover:underline"
                >
                  Methodology
                </Link>
                <Link
                  href="/data/"
                  className="underline-offset-2 hover:underline"
                >
                  Data
                </Link>
              </nav>
            </div>
          </header>
          <CaveatBanner />
          {children}
        </NuqsAdapter>
      </body>
    </html>
  );
}
