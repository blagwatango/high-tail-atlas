import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "High-Tail Atlas — modeled estimates of the population share at IQ ≥ 130",
  description:
    "Modeled estimates of the share of each country’s population at IQ ≥ 130. These are modeled estimates, not measurements or a ranking of nations.",
  robots: "noindex,nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              High-Tail Atlas
            </Link>
            <nav className="flex gap-4 text-sm text-stone-700">
              <Link href="/about/" className="underline-offset-2 hover:underline">
                About
              </Link>
              <Link
                href="/methodology/"
                className="underline-offset-2 hover:underline"
              >
                Methodology
              </Link>
            </nav>
          </div>
        </header>
        <aside
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-stone-900"
          aria-label="Important caveat"
        >
          <div className="mx-auto max-w-5xl">
            <p>
              These figures are <strong>modeled estimates</strong>, not
              measurements. Each percentage is the right tail of a normal
              distribution given a published or assumed country mean and SD
              (default 15), applied to UN population counts. National IQ
              compilations are incomplete and contested. This is{" "}
              <strong>not</strong> a ranking of people, nations, or worth.{" "}
              <Link href="/methodology/" className="font-medium underline">
                Read the methodology.
              </Link>
            </p>
          </div>
        </aside>
        {children}
      </body>
    </html>
  );
}
