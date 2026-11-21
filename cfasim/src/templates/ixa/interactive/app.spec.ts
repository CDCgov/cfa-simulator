import { test, expect } from "@playwright/test";

test("app renders and the model produces output", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "{{ project_name }}" }),
  ).toBeVisible();
  await expect(page.getByLabel("Population")).toBeVisible();
  await expect(page.getByLabel("Mean infectious period")).toBeVisible();

  // The axis label is drawn only once the model has booted and produced
  // output (an `svg path` alone would match the sidebar icons).
  await expect(page.getByText("cumulative infections")).toBeVisible({
    timeout: 30_000,
  });
});

test("params sync to and hydrate from the URL", async ({ page }) => {
  await page.goto("/?population=250&initialInfections=10");
  await expect(page.getByLabel("Population")).toHaveValue("250");
  await expect(page.getByLabel("Initial infections")).toHaveValue("10");
});

test("an invalid parameter shows the model's error", async ({ page }) => {
  await page.goto("/?infectiousPeriod=0");
  await expect(
    page.getByText("infectious period must be greater than zero"),
  ).toBeVisible({ timeout: 30_000 });
});
