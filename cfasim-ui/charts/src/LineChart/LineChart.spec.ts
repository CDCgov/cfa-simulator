import { test, expect } from "@playwright/test";

test("LineChart page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  const chartSvg = demos.first().locator("svg").last();
  await expect(chartSvg).toBeVisible();
  await expect(chartSvg.locator("path")).toBeAttached();
});

test("Expand fills the viewport even under a transformed ancestor", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const wrapper = page.locator(".line-chart-wrapper").first();
  await expect(wrapper).toBeVisible();

  // Make an ancestor a containing block for position:fixed — the classic
  // userland layout that broke the old CSS-class-only fullscreen (the fixed
  // box would fill this ancestor instead of the viewport).
  await wrapper.evaluate((el) => {
    const trap = el.closest(".demo-preview") ?? el.parentElement;
    if (trap instanceof HTMLElement) trap.style.transform = "translateZ(0)";
  });

  await wrapper.getByRole("button", { name: "Chart options" }).click();
  await page.getByRole("menuitem", { name: "Fullscreen" }).click();

  const expanded = page.locator(".line-chart-wrapper.is-fullscreen");
  await expect(expanded).toBeVisible();

  // Teleported to <body>, so it escapes the transformed ancestor...
  expect(
    await expanded.evaluate((el) => el.parentElement === document.body),
  ).toBe(true);
  // ...and actually covers the whole viewport.
  const box = await expanded.boundingBox();
  const vp = page.viewportSize();
  expect(box).not.toBeNull();
  expect(vp).not.toBeNull();
  expect(Math.round(box!.width)).toBe(vp!.width);
  expect(Math.round(box!.height)).toBe(vp!.height);

  // Escape collapses and returns the chart to its place.
  await page.keyboard.press("Escape");
  await expect(page.locator(".line-chart-wrapper.is-fullscreen")).toHaveCount(
    0,
  );
});

test("markers drag along the x-axis and update the bound model", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const readout = page.locator(".marker-demo-readout");
  await expect(readout).toContainText("Isolation: day 12.0");

  const hit = page.locator('[data-testid="marker-hit"]').first();
  await expect(hit).toBeAttached();
  // Raw mouse coords are viewport-relative and don't auto-scroll.
  await hit.scrollIntoViewIfNeeded();
  const box = await hit.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 80, y, { steps: 5 });
  await page.mouse.up();

  // The v-model readout moved with the drag...
  await expect(readout).not.toContainText("Isolation: day 12.0");
  // ...and so did the rendered line.
  const line = page.locator('[data-testid="marker-line"]').first();
  const movedBox = await line.boundingBox();
  expect(movedBox!.x).toBeGreaterThan(startX + 60);
});

test("marker labels respond to arrow keys", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const readout = page.locator(".marker-demo-readout");
  await expect(readout).toContainText("Recovery: day 32.0");
  const hit = page.locator('[data-testid="marker-hit"]').nth(1);
  await hit.focus();
  await page.keyboard.press("ArrowRight");
  await expect(readout).toContainText("Recovery: day 33.0");
});

test("drag zooms the x-range and the reset button restores it", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page.locator('[data-testid="zoom-line-chart"]');
  await chart.scrollIntoViewIfNeeded();
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
  // The hover tooltip gets out of the way while brushing.
  await expect(chart.locator(".chart-tooltip-content")).toHaveCount(0);
  await page.mouse.up();

  await expect(chart.locator('[data-testid="zoom-brush"]')).toHaveCount(0);
  await expect(reset).toBeVisible();
  // 120 points, brushed 25%–50% → roughly x = 30..60.
  const zoomed = (await ticks.allTextContents()).map(Number);
  expect(Math.min(...zoomed)).toBeGreaterThanOrEqual(29);
  expect(Math.max(...zoomed)).toBeLessThanOrEqual(60);
  // The drag didn't select page text.
  expect(await page.evaluate(() => getSelection()?.toString() ?? "")).toBe("");

  await reset.click();
  await expect(reset).toHaveCount(0);
  expect(await ticks.allTextContents()).toEqual(fullTicks);

  // Double-click resets too.
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 5 });
  await page.mouse.up();
  await expect(reset).toBeVisible();
  await overlay.dblclick();
  await expect(reset).toHaveCount(0);
});

test("a tall drag box-zooms both axes; a flat drag zooms x only", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page.locator('[data-testid="zoom-line-chart"]');
  await chart.scrollIntoViewIfNeeded();
  const overlay = chart.locator('[data-testid="chart-overlay"]');
  const brush = chart.locator('[data-testid="zoom-brush"]');
  const yTicks = async () =>
    (await chart.locator('[data-testid="y-tick"]').allTextContents()).map(
      Number,
    );
  const box = (await overlay.boundingBox())!;

  // Flat drag: the selection is a full-height band.
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.5,
    box.y + box.height * 0.5 + 10,
    { steps: 5 },
  );
  expect(Math.round(Number(await brush.getAttribute("height")))).toBe(
    Math.round(box.height),
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(chart.getByRole("button", { name: "Reset zoom" })).toHaveCount(
    0,
  );

  // Tall drag over the bottom half: the selection is a box, and the y axis
  // zooms to it instead of rescaling to the peak (400).
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height, {
    steps: 5,
  });
  expect(Math.round(Number(await brush.getAttribute("height")))).toBe(
    Math.round(box.height / 2),
  );
  await page.mouse.up();
  await expect(chart.getByRole("button", { name: "Reset zoom" })).toBeVisible();
  expect(Math.max(...(await yTicks()))).toBeLessThanOrEqual(200);
});
