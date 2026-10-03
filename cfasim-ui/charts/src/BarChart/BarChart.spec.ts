import { test, expect } from "@playwright/test";

test("BarChart page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  const chartSvg = demos.first().locator("svg").last();
  await expect(chartSvg).toBeVisible();
  await expect(chartSvg.locator('[data-testid="bar"]').first()).toBeAttached();
});

test("BarChart thins crowded categorical labels", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  const chart = page.locator('[data-testid="thinned-bar-chart"]');
  await expect(chart).toBeVisible();
  const bars = chart.locator('[data-testid="bar"]');
  const ticks = chart.locator('[data-testid="category-tick"]');
  // Every category still gets a bar; only labels are thinned.
  await expect(bars).toHaveCount(14);
  expect(await ticks.count()).toBeLessThan(14);
  expect(await ticks.count()).toBeGreaterThan(0);
});

test("drag zooms to the brushed categories and reset restores them", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  const chart = page.locator('[data-testid="zoom-bar-chart"]');
  await chart.scrollIntoViewIfNeeded();
  const overlay = chart.locator('[data-testid="chart-overlay"]');
  const bars = chart.locator('[data-testid="bar"]');
  await expect(bars).toHaveCount(40);

  const box = (await overlay.boundingBox())!;
  const y = box.y + box.height / 2;
  // Mid-slot 10 → mid-slot 19 of 40.
  await page.mouse.move(box.x + (box.width * 10.5) / 40, y);
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * 19.5) / 40, y, { steps: 5 });
  await expect(chart.locator('[data-testid="zoom-brush"]')).toBeVisible();
  await page.mouse.up();

  await expect(bars).toHaveCount(10);
  await expect(bars.first()).toHaveAttribute("data-category", "10");
  await expect(bars.last()).toHaveAttribute("data-category", "19");

  await chart.getByRole("button", { name: "Reset zoom" }).click();
  await expect(bars).toHaveCount(40);
});

test("legend buttons hide and restore bar series", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/bar-chart");
  const chart = page.locator('[data-testid="legend-toggle-bar-chart"]');
  await chart.scrollIntoViewIfNeeded();
  const bars = chart.locator('[data-testid="bar"]');
  await expect(bars).toHaveCount(8);
  const toggle = chart.getByRole("button", { name: "Unvaccinated" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(bars).toHaveCount(4);
  await toggle.click();
  await expect(bars).toHaveCount(8);
});
