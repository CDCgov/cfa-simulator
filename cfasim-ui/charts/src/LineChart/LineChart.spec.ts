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

test("the tooltip stays up over a marker's line", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const hit = page.locator('[data-testid="marker-hit"]').first();
  await expect(hit).toBeAttached();
  await hit.scrollIntoViewIfNeeded();
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

  // Onto the marker's hit line, which sits over the overlay.
  await page.mouse.move(x, y);
  expect(
    await page.evaluate(
      ([px, py]) =>
        document.elementFromPoint(px, py)?.getAttribute("data-testid"),
      [x, y],
    ),
  ).toBe("marker-hit");
  await expect(tooltip).toBeVisible();

  // Off the plot, below the axis, hides it as before.
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

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("a marker keeps dragging when the finger leaves it", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch is dispatched through CDP");
    await page.goto("./cfasim-ui/charts/line-chart");
    const readout = page.locator(".marker-demo-readout");
    await expect(readout).toContainText("Isolation: day 12.0");

    const hit = page.locator('[data-testid="marker-hit"]').first();
    await hit.scrollIntoViewIfNeeded();
    const box = (await hit.boundingBox())!;
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height / 2;
    await page.evaluate(() => {
      (window as any).__cancelled = 0;
      window.addEventListener("pointercancel", () => {
        (window as any).__cancelled++;
      });
    });

    // Chrome ignores touch-action on SVG descendants: without the
    // component cancelling touchmove, the page scroll claims the
    // gesture after a few pixels and the drag ends in pointercancel.
    const cdp = await context.newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      x = 0,
      y = 0,
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    await touch("touchStart", x0, y0);
    for (let i = 1; i <= 10; i++) {
      // Drifts upward past the plot while moving right.
      await touch("touchMove", x0 + 12 * i, y0 - 30 * i);
      await page.waitForTimeout(16);
    }
    await touch("touchEnd");

    expect(await page.evaluate(() => (window as any).__cancelled)).toBe(0);
    const line = page.locator('[data-testid="marker-line"]').first();
    const movedBox = (await line.boundingBox())!;
    expect(movedBox.x).toBeGreaterThan(x0 + 100);
  });
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

test("legend buttons toggle series by keyboard and keep working expanded", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page.locator('[data-testid="legend-toggle-line-chart"]');
  await chart.scrollIntoViewIfNeeded();
  const yMax = async () =>
    Math.max(
      ...(await chart.locator('[data-testid="y-tick"]').allTextContents()).map(
        Number,
      ),
    );
  const group = chart.getByRole("group", { name: "Show or hide series" });
  const baseline = group.getByRole("button", { name: "Baseline" });
  await expect(group.getByRole("button")).toHaveCount(3);
  await expect(baseline).toHaveAttribute("aria-pressed", "true");
  expect(await yMax()).toBeGreaterThan(500);

  // Each button covers its legend label in the svg.
  const overLabel = async () => {
    const b = (await baseline.boundingBox())!;
    const t = (await chart
      .locator("svg text", { hasText: /^\s*Baseline\s*$/ })
      .boundingBox())!;
    expect(t.x).toBeGreaterThanOrEqual(b.x);
    expect(t.x + t.width).toBeLessThanOrEqual(b.x + b.width);
    expect(b.x + b.width - (t.x + t.width)).toBeLessThanOrEqual(6);
    expect(t.y).toBeGreaterThanOrEqual(b.y - 1);
    expect(t.y + t.height).toBeLessThanOrEqual(b.y + b.height + 1);
  };
  await overLabel();

  await baseline.focus();
  await page.keyboard.press("Enter");
  await expect(baseline).toHaveAttribute("aria-pressed", "false");
  expect(await yMax()).toBeLessThanOrEqual(500);
  await page.keyboard.press("Space");
  await expect(baseline).toHaveAttribute("aria-pressed", "true");

  await chart.getByRole("button", { name: "Chart options" }).click();
  await page.getByRole("menuitem", { name: "Fullscreen" }).click();
  await expect(chart).toHaveClass(/is-fullscreen/);
  await overLabel();
  await baseline.click();
  await expect(baseline).toHaveAttribute("aria-pressed", "false");
  expect(await yMax()).toBeLessThanOrEqual(500);
});

test("LineChart draws calibration intervals above the trajectories", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page.locator('[data-testid="calibration-chart"]');
  await chart.scrollIntoViewIfNeeded();
  const intervals = chart.locator('[data-testid="interval"]');
  await expect(intervals).toHaveCount(4);
  const first = intervals.first();
  await expect(first.locator("line.interval-cap")).toHaveCount(2);
  await expect(first.locator("circle.interval-dot")).toHaveCount(1);
  await expect(first.locator("line.interval-line")).toHaveAttribute(
    "stroke",
    "#c2410c",
  );
  // The whiskers sit after every series path in paint order.
  const order = await chart
    .locator("svg")
    .last()
    .evaluate((svg) => {
      const nodes = Array.from(
        svg.querySelectorAll("path[fill='none'], [data-testid='interval']"),
      );
      return nodes.map((n) => (n.tagName === "path" ? "p" : "i")).join("");
    });
  expect(order).toMatch(/^p+i{4}$/);
});

test("tooltip stops at every x of every series, not just the first", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page
    .locator(".line-chart-wrapper")
    .filter({ hasText: "Weekly" })
    .first();
  await chart.scrollIntoViewIfNeeded();
  const overlay = chart.locator("rect[fill='transparent']").first();
  const box = (await overlay.boundingBox())!;
  const labels = new Set<string>();
  for (let i = 0; i <= 60; i++) {
    await page.mouse.move(box.x + (box.width * i) / 60, box.y + box.height / 2);
    const label = chart.locator(".chart-tooltip-label");
    await expect(label).toBeVisible();
    labels.add((await label.textContent())!.trim());
    await expect(chart.locator(".chart-tooltip-row")).toHaveCount(2);
  }
  // Daily series has 29 points; the weekly one adds none outside that set.
  expect(labels.size).toBe(29);
});

test("default tooltip names rows and leaves unnamed fan lines out", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page
    .locator(".line-chart-wrapper")
    .filter({ hasText: "90% interval" })
    .first();
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart
    .locator("rect[fill='transparent']")
    .first()
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(chart.locator(".chart-tooltip-label")).toHaveText(/^Day \d+$/);
  await expect(chart.locator(".chart-tooltip-name")).toHaveText([
    "Median",
    "90% interval",
  ]);
  // Values sit flush right, past their names.
  const body = (await chart.locator(".chart-tooltip-body").boundingBox())!;
  for (const row of await chart.locator(".chart-tooltip-row").all()) {
    const name = (await row.locator(".chart-tooltip-name").boundingBox())!;
    const value = (await row.locator(".chart-tooltip-value").boundingBox())!;
    expect(value.x).toBeGreaterThan(name.x + name.width);
    expect(body.x + body.width - (value.x + value.width)).toBeLessThan(1);
  }
});

test("the tooltip keeps dark text on a light fallback without the theme", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  // An unthemed host page with light text: the tokens are unset and the
  // body's color would otherwise reach the tooltip by inheritance.
  await page.evaluate(() => {
    for (const token of ["--color-text", "--color-bg-0"]) {
      document.documentElement.style.setProperty(token, "initial");
    }
    document.body.style.color = "rgb(255, 255, 255)";
  });
  const chart = page
    .locator(".line-chart-wrapper")
    .filter({ hasText: "90% interval" })
    .first();
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart
    .locator("rect[fill='transparent']")
    .first()
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const tooltip = chart.locator(".chart-tooltip-content");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(tooltip).toHaveCSS("color", "rgb(33, 37, 41)");
});

test("Save as SVG resolves theme colors to what the page shows", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const wrapper = page.locator(".line-chart-wrapper").first();
  await expect(wrapper).toBeVisible();
  // A paint through an alias token (var → var → light-dark) and a direct
  // light-dark(): neither resolves once the svg leaves the page.
  await wrapper.evaluate((el) => {
    const svg = el.querySelector(":scope > svg")!;
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
    page.getByRole("menuitem", { name: "Save as SVG" }).click(),
  ]);
  const stream = await download.createReadStream();
  let xml = "";
  for await (const chunk of stream) xml += chunk;

  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  expect(xml).toMatch(/id="export-alias" fill="rgb\(26, 26, 26\)"/);
  expect(xml).toMatch(/id="export-direct" fill="rgb\(0, 0, 0\)"/);
  expect(xml).not.toMatch(/(fill|stroke)="[^"]*(var|light-dark)\(/);
});

test("Save as PNG downloads the chart at twice its size", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/line-chart");
  const wrapper = page.locator(".line-chart-wrapper").first();
  await expect(wrapper).toBeVisible();
  const size = await wrapper.locator(":scope > svg").evaluate((svg) => ({
    w: (svg as SVGSVGElement).width.baseVal.value,
    h: (svg as SVGSVGElement).height.baseVal.value,
  }));

  await wrapper.getByRole("button", { name: "Chart options" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Save as PNG" }).click(),
  ]);
  // The PNG signature plus the IHDR chunk fit in the first stream chunk.
  const stream = await download.createReadStream();
  const head: Uint8Array = (await stream[Symbol.asyncIterator]().next()).value;
  stream.destroy();
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);

  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(String.fromCharCode(...head.subarray(1, 4))).toBe("PNG");
  // IHDR width and height, big-endian, right after the 8-byte signature.
  expect(view.getUint32(16)).toBe(size.w * 2);
  expect(view.getUint32(20)).toBe(size.h * 2);
});
