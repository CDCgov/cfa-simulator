import { test, expect } from "@playwright/test";
import { scrollIntoSettledView } from "../_shared/e2e.testUtils.js";

test("Expand fills the viewport even under a transformed ancestor", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const wrapper = page.locator(".line-chart-wrapper").first();
  await expect(wrapper).toBeVisible();

  await wrapper.evaluate((element) => {
    const trap = element.closest(".demo-preview") ?? element.parentElement;
    if (trap instanceof HTMLElement) trap.style.transform = "translateZ(0)";
  });

  await wrapper.getByRole("button", { name: "Chart options" }).click();
  await page.getByRole("menuitem", { name: "Fullscreen" }).click();

  const expanded = page.locator(".line-chart-wrapper.is-fullscreen");
  await expect(expanded).toBeVisible();
  expect(
    await expanded.evaluate(
      (element) => element.parentElement === document.body,
    ),
  ).toBe(true);

  const box = (await expanded.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.round(box.width)).toBe(viewport.width);
  expect(Math.round(box.height)).toBe(viewport.height);

  await page.keyboard.press("Escape");
  await expect(expanded).toHaveCount(0);
});

test("the tooltip stays up over a marker's line", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const hit = page.locator('[data-testid="marker-hit"]').first();
  await expect(hit).toBeAttached();
  await scrollIntoSettledView(hit);
  const box = (await hit.boundingBox())!;
  const chart = page
    .locator(".line-chart-wrapper")
    .filter({ has: page.locator('[data-testid="marker-hit"]') })
    .first();
  const tooltip = chart.locator(".chart-tooltip-content");
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.75;

  await page.mouse.move(x - 40, y);
  await page.mouse.move(x - 30, y);
  await expect(tooltip).toBeVisible();

  await page.mouse.move(x, y);
  expect(
    await page.evaluate(
      ([pointX, pointY]) =>
        document.elementFromPoint(pointX, pointY)?.getAttribute("data-testid"),
      [x, y],
    ),
  ).toBe("marker-hit");
  await expect(tooltip).toBeVisible();

  await page.mouse.move(x, box.y + box.height + 60);
  await expect(tooltip).toBeHidden();
});

test("markers drag along the x-axis and update the bound model", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const readout = page.locator(".marker-demo-readout");
  await expect(readout).toContainText("Isolation: day 12.0");

  const hit = page.locator('[data-testid="marker-hit"]').first();
  await expect(hit).toBeAttached();
  await scrollIntoSettledView(hit);
  const box = (await hit.boundingBox())!;
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 80, y, { steps: 5 });
  await page.mouse.up();

  await expect(readout).not.toContainText("Isolation: day 12.0");
  const movedBox = (await page
    .locator('[data-testid="marker-line"]')
    .first()
    .boundingBox())!;
  expect(movedBox.x).toBeGreaterThan(startX + 60);
});

test("drag zooms the x-range and the reset button restores it", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page.locator('[data-testid="zoom-line-chart"]');
  await scrollIntoSettledView(chart);
  const overlay = chart.locator('[data-testid="chart-overlay"]');
  const ticks = chart.locator('[data-testid="x-tick"]');
  const fullTicks = await ticks.allTextContents();
  const reset = chart.getByRole("button", { name: "Reset zoom" });
  await expect(reset).toHaveCount(0);

  const box = (await overlay.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 5 });
  await expect(chart.locator('[data-testid="zoom-brush"]')).toBeVisible();
  await expect(chart.locator(".chart-tooltip-content")).toHaveCount(0);
  await page.mouse.up();

  await expect(chart.locator('[data-testid="zoom-brush"]')).toHaveCount(0);
  await expect(reset).toBeVisible();
  const zoomed = (await ticks.allTextContents()).map(Number);
  expect(Math.min(...zoomed)).toBeGreaterThanOrEqual(29);
  expect(Math.max(...zoomed)).toBeLessThanOrEqual(60);
  expect(await page.evaluate(() => getSelection()?.toString() ?? "")).toBe("");

  await reset.click();
  await expect(reset).toHaveCount(0);
  expect(await ticks.allTextContents()).toEqual(fullTicks);
});

test("Save SVG resolves theme colors to what the page shows", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const wrapper = page.locator(".line-chart-wrapper").first();
  await expect(wrapper).toBeVisible();
  await wrapper.evaluate((element) => {
    const svg = element.querySelector(":scope > svg")!;
    for (const [id, fill] of [
      ["alias", "var(--color-bg)"],
      ["direct", "light-dark(#ffffff, #000000)"],
    ]) {
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      rect.id = `export-${id}`;
      rect.setAttribute("fill", fill);
      svg.appendChild(rect);
    }
  });

  await wrapper.getByRole("button", { name: "Chart options" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Save SVG" }).click(),
  ]);
  const stream = await download.createReadStream();
  let xml = "";
  for await (const chunk of stream) xml += chunk;

  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  expect(xml).toMatch(/id="export-alias" fill="rgb\(26, 26, 26\)"/);
  expect(xml).toMatch(/id="export-direct" fill="rgb\(0, 0, 0\)"/);
  expect(xml).not.toMatch(/(fill|stroke)="[^"]*(var|light-dark)\(/);
});
