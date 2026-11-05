import { test, expect } from "@playwright/test";
import { scrollIntoSettledView } from "../_shared/e2e.testUtils.js";

test("Heatmap page renders the demos with labels and a legend", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  await expect(page.locator("h1")).toBeVisible();
  const chart = page.locator('[data-testid="scores-heatmap"]');
  await expect(chart).toBeVisible();
  await expect(chart.locator('[data-testid="cell"]')).toHaveCount(48);
  await expect(chart.locator('[data-testid="cell-label"]')).toHaveCount(48);
  await expect(
    chart.locator('[data-testid="legend-color-scale"]'),
  ).toBeVisible();
  // Column labels sit above the cells with the row header on their row.
  const header = chart.locator('[data-testid="row-header"]');
  const firstCell = chart.locator('[data-testid="cell"]').first();
  expect((await header.boundingBox())!.y).toBeLessThan(
    (await firstCell.boundingBox())!.y,
  );
  // 24 hour columns do not fit flat, so the labels turn.
  const hourly = page.locator('[data-testid="hourly-heatmap"]');
  await hourly.scrollIntoViewIfNeeded();
  await expect(
    hourly.locator('[data-testid="column-label"]').first(),
  ).toHaveAttribute("transform", /rotate\(-(45|90)/);
});

test("tilted column labels stay inside the chart", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="long-labels-heatmap"]');
  await scrollIntoSettledView(chart);
  const svg = (await chart.locator(".heatmap-plot > svg").boundingBox())!;
  const labels = chart.locator('[data-testid="column-label"]');
  await expect(labels).toHaveCount(6);
  await expect(labels.last()).toHaveText("Gradient boosting");
  for (const label of await labels.all()) {
    const box = (await label.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(svg.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(svg.x + svg.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(svg.y - 1);
  }
});

test("hovering a cell shows its tooltip and sorting reorders the rows", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="scores-heatmap"]');
  await scrollIntoSettledView(chart);
  const cell = chart.locator(
    '[data-testid="cell"][data-row="2"][data-column="1"]',
  );
  const box = (await cell.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const tooltip = chart.locator(".chart-tooltip-content");
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator(".chart-tooltip-label")).toHaveText("Delaware");
  await expect(tooltip.locator(".chart-tooltip-name")).toHaveText("Baseline");
  await expect(chart.locator('[data-testid="cell-highlight"]')).toBeVisible();

  await page.getByLabel("Sort locations by").click();
  await page.getByRole("option", { name: "Baseline" }).click();
  const labels = chart.locator('[data-testid="row-label"]');
  const sorted = await labels.allTextContents();
  expect(sorted[0]).not.toBe("Alabama");
  // Baseline scores now ascend down the rows.
  const values = await chart
    .locator('[data-testid="cell-label"]')
    .allTextContents();
  const baseline = values.filter((_, i) => i % 4 === 1).map(Number);
  expect(baseline).toEqual([...baseline].sort((a, b) => a - b));
});

test("keyboard users reach cells through the interactive buttons", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="scores-heatmap"]');
  await chart.scrollIntoViewIfNeeded();
  const first = chart.locator('[data-cell="0:0"]');
  await first.focus();
  await expect(chart.locator(".chart-tooltip-content")).toContainText(
    "Alabama",
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(chart.locator('[data-cell="1:1"]')).toBeFocused();
  await expect(chart.locator(".chart-tooltip-label")).toHaveText("Colorado");
  await expect(chart.locator(".chart-tooltip-name")).toHaveText("Baseline");
  await page.keyboard.press("Home");
  await expect(chart.locator('[data-cell="1:-1"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Clicked: Colorado")).toBeVisible();
});
