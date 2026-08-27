import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { CaveatBanner } from "@/components/CaveatBanner";
import { SkipLinks } from "@/components/SkipLinks";
import "./globals.css";

const TITLE =
  "High-Tail Atlas — modeled share of 15-year-olds at PISA mathematics ≥ 700";
const DESCRIPTION =
  "Modeled estimates of the share of 15-year-olds at PISA mathematics ≥ 700. OECD PISA 2022 school scores, not IQ, not a ranking of nations.";

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
      <body className="min-h-screen overflow-x-clip bg-stone-50 text-stone-900 antialiased">
        <NuqsAdapter>
          <SkipLinks />
          <header className="border-b border-stone-200 bg-white">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:py-3">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center font-semibold tracking-tight"
              >
                High-Tail Atlas
              </Link>
              <nav className="flex flex-wrap items-center text-sm text-stone-700">
                <Link
                  href="/about/"
                  className="inline-flex min-h-11 items-center px-2 underline-offset-2 hover:underline"
                >
                  About
                </Link>
                <Link
                  href="/methodology/"
                  className="inline-flex min-h-11 items-center px-2 underline-offset-2 hover:underline"
                >
                  Methodology
                </Link>
                <Link
                  href="/data/"
                  className="inline-flex min-h-11 items-center px-2 underline-offset-2 hover:underline"
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
