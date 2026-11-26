import { test, expect, type Page } from "@playwright/test";
import { scrollIntoSettledView } from "../_shared/e2e.testUtils.js";

async function mapAt(page: Page, testId: string) {
  const selector = `[data-testid="${testId}"]`;
  await page.waitForFunction(
    (sel) => {
      if (document.querySelector(sel)) return true;
      window.scrollBy(0, window.innerHeight);
      return false;
    },
    selector,
    { polling: 100 },
  );
  const map = page.locator(selector);
  await scrollIntoSettledView(map);
  return map;
}

test("canvas renderer paints and hit-tests the custom geography", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/choropleth-map#custom-geography-regions");
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

  const painted = await map
    .locator("canvas.choropleth-canvas")
    .evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("2d")!;
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 0) count++;
      return count;
    });
  expect(painted).toBeGreaterThan(0);
});
