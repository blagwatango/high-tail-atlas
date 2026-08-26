import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "4173";
const prefix = (process.env.PLAYWRIGHT_BASE_PATH || "").replace(/\/$/, "");
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "static-export.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: origin,
    trace: "on-first-retry",
  },
  webServer: {
    command: `node scripts/serve-out.mjs --port ${port}${prefix ? ` --prefix ${prefix}` : ""}`,
    url: `${origin}${prefix}/data/atlas.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
