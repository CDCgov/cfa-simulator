import { test, expect } from "@playwright/test";

test("app renders and the model produces output", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "%%project_name%%" }),
  ).toBeVisible();
  await expect(page.getByLabel("Steps")).toBeVisible();
  await expect(page.getByLabel("Rate")).toBeVisible();

  // WASM loads and the model runs before the chart appears.
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 15_000,
  });
});

test("params sync to and hydrate from the URL", async ({ page }) => {
  await page.goto("/?steps=15&rate=3");
  await expect(page.getByLabel("Steps")).toHaveValue("15");
  await expect(page.getByLabel("Rate")).toHaveValue("3");
});
