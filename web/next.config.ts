import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Playwright hits 127.0.0.1; Next 16 otherwise blocks /_next chunks.
  allowedDevOrigins: ["127.0.0.1"],
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
