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

test("Escape hides a focused cell's tooltip until the next arrow key", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="scores-heatmap"]');
  await chart.scrollIntoViewIfNeeded();
  const tooltip = chart.locator(".chart-tooltip-content");
  await chart.locator('[data-cell="0:3"]').focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await expect(chart.locator('[data-cell="0:3"]')).toBeFocused();
  // Last column: ArrowRight stays put and brings the tooltip back.
  await page.keyboard.press("ArrowRight");
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowDown");
  await expect(tooltip.locator(".chart-tooltip-label")).toHaveText("Colorado");
});

test("a wide chart scrolls under its pinned row labels", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="scrolling-heatmap"]');
  await scrollIntoSettledView(chart);
  const scroller = chart.locator(".heatmap-plot");
  const [clientWidth, scrollWidth] = await scroller.evaluate((el) => [
    el.clientWidth,
    el.scrollWidth,
  ]);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
  // Every value stays printed: no column is too narrow for its label.
  await expect(chart.locator('[data-testid="cell-label"]')).toHaveCount(24);

  const pinnedLabel = chart.locator('[data-testid="pinned-row-label"]').first();
  const before = (await pinnedLabel.boundingBox())!;
  const pinned = (await chart.locator(".heatmap-pinned").boundingBox())!;

  // Keyboard focus on the last column scrolls it into view, clear of the
  // pinned strip.
  await chart.locator('[data-cell="0:5"]').focus();
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  const lastCell = chart.locator(
    '[data-testid="cell"][data-row="0"][data-column="5"]',
  );
  const cellBox = (await lastCell.boundingBox())!;
  expect(cellBox.x).toBeGreaterThanOrEqual(pinned.x + pinned.width - 1);
  expect((await pinnedLabel.boundingBox())!.x).toBeCloseTo(before.x, 0);
  await expect(chart.locator('[data-testid="pinned-bg"]')).toBeVisible();
  // The tooltip follows the cell to where focus scrolled it.
  const tooltip = chart.locator(".chart-tooltip-content");
  await expect(tooltip.locator(".chart-tooltip-label")).toHaveText("Alabama");
  await expect
    .poll(async () => {
      const box = (await tooltip.boundingBox())!;
      return (
        box.x <= cellBox.x + cellBox.width && box.x + box.width >= cellBox.x
      );
    })
    .toBe(true);

  // The pinned strip hides the cells scrolled under it from the pointer.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.mouse.move(cellBox.x + 4, cellBox.y + 4);
  await expect(chart.locator(".chart-tooltip-name")).toHaveText(
    "Gradient boosting",
  );
  await page.mouse.move(pinned.x + pinned.width / 2, cellBox.y + 4);
  await expect(chart.locator(".chart-tooltip-content")).toHaveCount(0);

  // A wheel over the pinned strip scrolls the plot.
  const scrolled = await scroller.evaluate((el) => el.scrollLeft);
  await page.mouse.wheel(-80, 0);
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollLeft))
    .toBeLessThan(scrolled);
});

test("a wide chart in a min-width: 0 grid track scrolls inside it", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="scrolling-heatmap"]');
  await scrollIntoSettledView(chart);
  // Put the demo in the first of two equal grid columns. Like any wide
  // content, the chart widens its track unless the item has min-width: 0.
  await chart.evaluate((el) => {
    const host = el.parentElement!;
    host.style.cssText =
      "display: grid; grid-template-columns: 1fr 1fr; width: 600px";
    el.style.minWidth = "0";
    host.append(document.createElement("div"));
  });
  const scroller = chart.locator(".heatmap-plot");
  await expect
    .poll(() => chart.evaluate((el) => el.getBoundingClientRect().width))
    .toBeLessThanOrEqual(300);
  const [clientWidth, scrollWidth] = await scroller.evaluate((el) => [
    el.clientWidth,
    el.scrollWidth,
  ]);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
});
