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

test("demo choropleth has at least one data-bin country", async ({ page }) => {
  await page.goto("/");
  const map = page.getByTestId("choropleth-map");
  await expect(map).toBeVisible({ timeout: 30_000 });
  const filled = map.locator("path[data-fill-kind='bin']");
  await expect(filled.first()).toBeVisible({ timeout: 30_000 });
  expect(await filled.count()).toBeGreaterThanOrEqual(1);
  await expect(map.locator('path[data-iso3="USA"]')).toHaveAttribute(
    "data-fill-kind",
    "bin",
  );
  await expect(map.locator('path[data-iso3="USA"]')).not.toHaveAttribute(
    "data-fill",
    "#d1d5db",
  );
  await expect(map.locator('path[data-iso3="USA"]')).not.toHaveAttribute(
    "data-fill",
    "#e5e7eb",
  );
  await expect(page.getByTestId("color-legend")).toContainText(
    "Modeled share of population at IQ ≥ 130 (normal tail). Bins are coarse on purpose.",
  );
  await expect(page.getByTestId("color-legend")).toContainText(
    "μ=100, σ=15 → 2.28%.",
  );
});

test("clicking a filled country opens the detail stub", async ({ page }) => {
  await page.goto("/");
  const usa = page.locator('path[data-iso3="USA"][data-fill-kind="bin"]');
  await expect(usa).toBeVisible({ timeout: 30_000 });
  await usa.click();
  const drawer = page.getByTestId("country-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Estimated share modeled at IQ ≥ 130");
  await expect(drawer).toContainText("This is a model output, not a count.");
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
