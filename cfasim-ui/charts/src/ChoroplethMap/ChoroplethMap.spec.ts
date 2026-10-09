import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./cfasim-ui/charts/choropleth-map");
});

/** A demo map on the page, scrolled into view. */
async function mapAt(page: Page, testId: string) {
  const map = page.locator(`[data-testid="${testId}"]`);
  await map.scrollIntoViewIfNeeded();
  return map;
}

test("custom geography renders every country with the default legend and tooltip", async ({
  page,
}) => {
  const map = await mapAt(page, "world-map");
  const paths = map.locator("path.state-path");
  // 177 countries in world-atlas 110m, three without an id.
  await expect(paths).toHaveCount(174);
  await expect(map.locator(".choropleth-legend-gradient")).toBeVisible();
  await expect(map.locator(".choropleth-outline")).toBeAttached();

  await expect(map.locator('path[data-feat-id="250"]')).toHaveAttribute(
    "aria-label",
    /^France: \d+$/,
  );
  // Brazil is one compact polygon, so its bounding-box center is on land.
  const brazil = map.locator('path[data-feat-id="076"]');
  await brazil.hover();
  const tooltip = page.locator(".chart-tooltip-content", { hasText: "Brazil" });
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Value:");
});

test("projection switch refits the custom geography", async ({ page }) => {
  const map = await mapAt(page, "world-map");
  const france = map.locator('path[data-feat-id="250"]');
  const before = await france.getAttribute("d");
  expect(before).not.toContain("NaN");
  await page
    .locator('[data-testid="world-projection"]')
    .selectOption("mercator");
  await expect.poll(() => france.getAttribute("d")).not.toBe(before);
  expect(await france.getAttribute("d")).not.toContain("NaN");
});

test("click-to-focus highlights a country in custom geography", async ({
  page,
}) => {
  const map = await mapAt(page, "world-map");
  const brazil = map.locator('path[data-feat-id="076"]');
  await brazil.click();
  // Focus (focus-zoom off) applies the highlight stroke in place.
  await expect
    .poll(() => brazil.evaluate((el) => (el as SVGPathElement).style.stroke))
    .not.toBe("");
  await brazil.click();
  // Hover keeps a highlight of its own; leave the map before checking.
  await page.mouse.move(0, 0);
  await expect
    .poll(() => brazil.evaluate((el) => (el as SVGPathElement).style.stroke))
    .toBe("");
});

test("canvas renderer paints and hit-tests the custom geography", async ({
  page,
}) => {
  const map = await mapAt(page, "world-map");
  // Anchor the pointer on a country while it is still a DOM path.
  const brazil = map.locator('path[data-feat-id="076"]');
  const box = (await brazil.boundingBox())!;
  await page.locator('[data-testid="world-renderer"]').selectOption("canvas");
  await expect(map.locator("canvas.choropleth-canvas")).toBeVisible();
  await expect(map.locator("path.state-path")).toHaveCount(0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const tooltip = page.locator(".chart-tooltip-content", { hasText: "Brazil" });
  await expect(tooltip).toBeVisible();
  // The canvas actually painted something (not a blank surface).
  const painted = await map
    .locator("canvas.choropleth-canvas")
    .evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 0) n++;
      return n;
    });
  expect(painted).toBeGreaterThan(0);
});

test("GeoJSON zones draw a borders mesh and categorical fills", async ({
  page,
}) => {
  const map = await mapAt(page, "zones-map");
  await expect(map.locator("path.state-path")).toHaveCount(24);
  await expect(map.locator(".choropleth-state-borders")).toBeAttached();
  await expect(map.locator(".choropleth-legend-item")).toHaveCount(3);
  const zone = map.locator('path[data-feat-id="Z1"]');
  await expect(zone).toHaveAttribute("aria-label", "Zone 1: Watch");
  await zone.hover();
  const tooltip = page.locator(".chart-tooltip-content", { hasText: "Zone 1" });
  await expect(tooltip).toContainText("North West: Watch");
});
