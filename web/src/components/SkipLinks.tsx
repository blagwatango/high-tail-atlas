"use client";

import { usePathname } from "next/navigation";

export function SkipLinks() {
  const path = usePathname();
  const isHome = path === "/" || path === "";
  return (
    <nav className="skip-links" aria-label="Skip links">
      {isHome ? (
        <a className="skip-link" href="#country-table">
          Skip to country estimates table
        </a>
      ) : null}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
    </nav>
  );
}
