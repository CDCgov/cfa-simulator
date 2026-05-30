import { test, expect } from "@playwright/test";

test("Icon page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/icon");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().locator(".Icon")).toHaveCount(3);
});

test("base set icons render as inline SVGs", async ({ page }) => {
  await page.goto("./cfasim-ui/components/icon");
  // The "Base set" grid lists every pre-registered icon; each must resolve to
  // an <svg> (not the empty unregistered fallback).
  const gridIcons = page.locator(".base-icons .Icon");
  await expect(gridIcons.first()).toBeVisible();
  const count = await gridIcons.count();
  expect(count).toBe(26);
  await expect(page.locator(".base-icons .Icon svg")).toHaveCount(count);
});
