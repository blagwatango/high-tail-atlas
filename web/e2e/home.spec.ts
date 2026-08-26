import { expect, test } from "@playwright/test";

test("home page includes modeled estimates caveat", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("modeled estimates")).toBeVisible();
});
