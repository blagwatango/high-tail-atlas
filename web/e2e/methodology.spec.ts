import { expect, test } from "@playwright/test";

test("methodology page includes estimate language and the formula", async ({
  page,
}) => {
  await page.goto("/methodology/");
  await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
  await expect(page.getByText(/estimate/i).first()).toBeVisible();
  await expect(
    page.getByText("p = 1 - Phi((700 - mu) / sigma)").first(),
  ).toBeVisible();
  await expect(page.getByText("2.28%").first()).toBeVisible();
});

test("tail calculator updates the modeled estimate from μ/σ", async ({
  page,
}) => {
  await page.goto("/methodology/");
  const mu = page.getByRole("spinbutton", { name: "Mean μ (PISA points)" });
  await expect(mu).toHaveValue("500");
  await expect(
    page.getByText("Modeled estimate: 2.28%", { exact: false }),
  ).toBeVisible();

  await mu.fill("400");
  await expect(page.getByText("Modeled estimate: 0.13%")).toBeVisible();
});

test("data page points at atlas.json and documents the CSV schema", async ({
  page,
}) => {
  await page.goto("/data/");
  await expect(page.getByRole("heading", { name: "Data" })).toBeVisible();
  await expect(page.getByText(/estimate/i).first()).toBeVisible();
  await expect(
    page.getByText("p = 1 - Phi((700 - mu) / sigma)").first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /atlas\.json/ })).toBeVisible();
  await expect(
    page.getByText("browser preview — not the published artifact"),
  ).toBeVisible();
});
