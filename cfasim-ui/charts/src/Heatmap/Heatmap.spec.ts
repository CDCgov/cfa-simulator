import { test, expect } from "@playwright/test";
import { scrollIntoSettledView } from "../_shared/e2e.testUtils.js";

test("a wide chart scrolls under its pinned row labels", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="scrolling-heatmap"]');
  await scrollIntoSettledView(chart);
  const scroller = chart.locator(".heatmap-plot");
  const [clientWidth, scrollWidth] = await scroller.evaluate((element) => [
    element.clientWidth,
    element.scrollWidth,
  ]);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
  await expect(chart.locator('[data-testid="cell-label"]')).toHaveCount(24);

  const pinnedLabel = chart.locator('[data-testid="pinned-row-label"]').first();
  const before = (await pinnedLabel.boundingBox())!;
  const pinned = (await chart.locator(".heatmap-pinned").boundingBox())!;

  // Keyboard focus on the last column scrolls it into view, clear of the pinned strip.
  await chart.locator('[data-cell="0:5"]').focus();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const lastCell = chart.locator(
    '[data-testid="cell"][data-row="0"][data-column="5"]',
  );
  const cellBox = (await lastCell.boundingBox())!;
  expect(cellBox.x).toBeGreaterThanOrEqual(pinned.x + pinned.width - 1);
  expect((await pinnedLabel.boundingBox())!.x).toBeCloseTo(before.x, 0);
  await expect(chart.locator('[data-testid="pinned-bg"]')).toBeVisible();

  // The pinned strip hides scrolled cells from the pointer and forwards wheel scroll.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.mouse.move(cellBox.x + 4, cellBox.y + 4);
  await expect(chart.locator(".chart-tooltip-name")).toHaveText(
    "Gradient boosting",
  );
  await page.mouse.move(pinned.x + pinned.width / 2, cellBox.y + 4);
  await expect(chart.locator(".chart-tooltip-content")).toHaveCount(0);

  const scrolled = await scroller.evaluate((element) => element.scrollLeft);
  await page.mouse.wheel(-80, 0);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollLeft))
    .toBeLessThan(scrolled);
});

test("a wide chart in a min-width: 0 grid track scrolls inside it", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/heatmap");
  const chart = page.locator('[data-testid="scrolling-heatmap"]');
  await scrollIntoSettledView(chart);
  await chart.evaluate((element) => {
    const host = element.parentElement!;
    host.style.cssText =
      "display: grid; grid-template-columns: 1fr 1fr; width: 600px";
    element.style.minWidth = "0";
    host.append(document.createElement("div"));
  });
  const scroller = chart.locator(".heatmap-plot");
  await expect
    .poll(() =>
      chart.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeLessThanOrEqual(300);
  const [clientWidth, scrollWidth] = await scroller.evaluate((element) => [
    element.clientWidth,
    element.scrollWidth,
  ]);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
});
