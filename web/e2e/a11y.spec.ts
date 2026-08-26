import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("skip link moves keyboard focus to the country estimates table", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("filtered-ok-rows")).toBeVisible({
    timeout: 30_000,
  });

  await page.locator("body").press("Tab");
  const skip = page.getByRole("link", {
    name: "Skip to country estimates table",
  });
  await expect(skip).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#country-table")).toBeFocused();

  await page.keyboard.press("Tab");
  const focusedInTable = await page.evaluate(() => {
    const el = document.activeElement;
    return Boolean(el?.closest("#country-table"));
  });
  expect(focusedInTable).toBe(true);

  const map = page.getByTestId("choropleth-map");
  await expect(map).toBeVisible();
  const focusedIsMap = await page.evaluate(() => {
    const el = document.activeElement;
    return Boolean(el?.closest("[data-testid='choropleth-map']"));
  });
  expect(focusedIsMap).toBe(false);
});

test("home and methodology have no axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("filtered-ok-rows")).toBeVisible({
    timeout: 30_000,
  });
  const home = await new AxeBuilder({ page })
    .exclude("[data-testid='choropleth-map']")
    .exclude("[data-testid='lollipop'] svg")
    .analyze();
  expect(home.violations.map((v) => v.id)).toEqual([]);

  await page.goto("/methodology/");
  await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
  const methodology = await new AxeBuilder({ page }).analyze();
  expect(methodology.violations.map((v) => v.id)).toEqual([]);
});

test("checked-in OG PNG is served and demo pages stay noindex", async ({
  page,
}) => {
  await page.goto("/");
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/);
  await expect(robots).toHaveAttribute("content", /nofollow/);

  const og = page.locator('meta[property="og:image"]');
  await expect(og.first()).toHaveAttribute("content", /og\.png/);

  const ogRes = await page.request.get("/og.png");
  expect(ogRes.status()).toBe(200);
  expect(ogRes.headers()["content-type"]).toMatch(/image\/png/);
  const body = await ogRes.body();
  expect(body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
    true,
  );
  expect(body.length).toBeLessThan(500_000);

  const robotsTxt = await page.request.get("/robots.txt");
  expect(robotsTxt.status()).toBe(200);
  expect(await robotsTxt.text()).toMatch(/Disallow:\s*\//);
});
