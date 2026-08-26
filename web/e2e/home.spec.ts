import { expect, test } from "@playwright/test";

test("home page includes modeled estimates caveat", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByLabel("Important caveat");
  await expect(banner).toContainText("modeled estimates");
  await expect(banner.getByRole("link", { name: "Read the methodology." })).toBeVisible();
});

test("default filters yield at least one ok country above min population", async ({
  page,
}) => {
  await page.goto("/");
  const list = page.getByTestId("filtered-ok-rows");
  await expect(list).toBeVisible({ timeout: 30_000 });
  const count = Number(await list.getAttribute("data-count"));
  expect(count).toBeGreaterThanOrEqual(1);

  const rows = list.locator("li");
  const n = await rows.count();
  expect(n).toBe(count);
  expect(n).toBeGreaterThanOrEqual(1);

  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    await expect(row).toHaveAttribute("data-status", "ok");
    const pop = Number(await row.getAttribute("data-population"));
    expect(pop).toBeGreaterThanOrEqual(250_000);
    const quality = await row.getAttribute("data-quality");
    expect(quality).not.toBe("E");
    expect(quality).not.toBe("D");
  }

  const status = page.getByTestId("status-line");
  await expect(status).toContainText(/Showing \d+ of \d+ countries with estimates/);
});

test("demo dataset shows a DEMO DATA badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("demo-badge")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("demo-badge")).toHaveText("DEMO DATA");
});

test("home copy avoids ranking chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("filtered-ok-rows")).toBeVisible({
    timeout: 30_000,
  });
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("leaderboard");
  expect(body).not.toContain("iq rankings");
  expect(body).not.toContain("smartest country");
  expect(body).not.toContain("dumbest country");
  expect(body).not.toContain("national intelligence");
  expect(body).not.toContain("top 40");
  await expect(
    page.getByRole("heading", { name: "Country comparison (lollipop)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Estimated share of population modeled at IQ ≥ 130",
    }),
  ).toBeVisible();
});

test("lollipop binds percent shares and the 2.28% reference", async ({
  page,
}) => {
  await page.goto("/");
  const chart = page.getByTestId("lollipop");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  await expect(chart.getByTestId("lollipop-cap")).toHaveText(
    "40 countries in current sort (default: largest populations).",
  );
  await expect(
    chart.getByText("Estimated % of population modeled at IQ ≥ 130"),
  ).toBeVisible();
  await expect(chart.getByText("2.28%", { exact: true })).toBeVisible();

  const rows = chart.getByTestId("lollipop-rows").locator("li");
  await expect(rows.first()).toHaveAttribute("data-iso3", "IND");
  const pPct = Number(await rows.first().getAttribute("data-p-pct"));
  expect(pPct).toBeGreaterThan(1);
  expect(pPct).toBeLessThan(20);

  const n = await rows.count();
  expect(n).toBeGreaterThanOrEqual(1);
  expect(n).toBeLessThanOrEqual(40);
  const heads = chart.locator("[data-testid='lollipop-head']");
  await expect(heads).toHaveCount(n);
  await expect(heads.first()).toHaveAttribute("data-quality", "C");
  await expect(heads.first()).toHaveAttribute("fill", "#ffffff");
});

