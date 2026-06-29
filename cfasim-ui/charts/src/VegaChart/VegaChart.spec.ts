import { test, expect } from "@playwright/test";

test("VegaChart page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/vega-chart");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  // vega renders its own <svg class="marks"> into the container.
  const chartSvg = demos.first().locator(".vega-chart-container svg");
  await expect(chartSvg).toBeVisible();
  // Vega's SVG renderer draws every mark (including bars) as a <path>.
  await expect(chartSvg.locator("path").first()).toBeAttached();
});

test("shows a shared multi-series tooltip on hover", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/vega-chart");
  // The demo under the "Tooltips" heading is a 3-line chart with a rule-layer
  // crosshair tooltip listing every series at the hovered x.
  const demo = page
    .locator("#tooltips")
    .locator('xpath=following::*[contains(@class,"demo-preview")][1]');
  const svg = demo.locator(".vega-chart-container svg").first();
  await expect(svg).toBeVisible();
  // Deterministic multi-series check: three line marks + a legend naming each
  // compartment (the legend text lives in the SVG).
  await expect(svg.locator('g[class*="mark-line"] path')).toHaveCount(3);
  await expect(svg).toContainText("Susceptible");
  await expect(svg).toContainText("Infected");
  await expect(svg).toContainText("Recovered");

  // Bring the chart into the viewport (raw mouse.move below uses viewport
  // coords) and let the initial resize re-embed settle.
  await svg.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // The tooltip lives on the rule mark — a thin vertical line at each day that
  // only fires when the cursor lands exactly on it. Walk the rule <line>
  // elements (one per day), hovering each by its real geometry — entering from
  // outside the plot for a fresh pointerover — until the crosshair appears.
  const ruleLines = svg.locator("g.mark-rule.role-mark line");
  const tip = page.locator("#vg-tooltip-element");
  await expect(async () => {
    const svgBox = await svg.boundingBox();
    expect(svgBox).not.toBeNull();
    const y = svgBox!.y + svgBox!.height * 0.5;
    const count = await ruleLines.count();
    for (let i = 0; i < count; i++) {
      const x = await ruleLines
        .nth(i)
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.x + r.width / 2;
        })
        .catch(() => null);
      if (x == null) continue;
      await page.mouse.move(svgBox!.x - 30, y);
      await page.mouse.move(x, y, { steps: 4 });
      // vega-tooltip updates the DOM a frame after the pointer event.
      await page.waitForTimeout(120);
      if (await tip.isVisible().catch(() => false)) return;
    }
    throw new Error("tooltip did not appear");
  }).toPass({ timeout: 12000 });

  // The crosshair lists all three series at once.
  await expect(tip).toContainText("Susceptible");
  await expect(tip).toContainText("Infected");
  await expect(tip).toContainText("Recovered");
});

test("re-embeds with new colors when the theme toggles", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/vega-chart");
  // Start from a known light theme.
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  });
  const svg = page
    .locator(".demo-preview")
    .first()
    .locator(".vega-chart-container svg");
  const axisFill = () =>
    svg
      .locator("text")
      .first()
      .evaluate(
        (el) => el.getAttribute("fill") || getComputedStyle(el).fill || "",
      );
  await expect(svg.locator("text").first()).toBeAttached();
  const lightFill = await axisFill();

  // Toggle to dark — the MutationObserver should re-embed with dark colors.
  await page.evaluate(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
  });
  await expect.poll(axisFill).not.toBe(lightFill);
});

test("Expand fills the viewport even under a transformed ancestor", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/vega-chart");
  const wrapper = page.locator(".vega-chart-wrapper").first();
  await expect(wrapper).toBeVisible();

  // Make an ancestor a containing block for position:fixed — the layout that
  // breaks CSS-class-only fullscreen unless the chart teleports out.
  await wrapper.evaluate((el) => {
    const trap = el.closest(".demo-preview") ?? el.parentElement;
    if (trap instanceof HTMLElement) trap.style.transform = "translateZ(0)";
  });

  await wrapper.getByRole("button", { name: "Chart options" }).click();
  await page.getByRole("menuitem", { name: "Fullscreen" }).click();

  const expanded = page.locator(".vega-chart-wrapper.is-fullscreen");
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
  await expect(page.locator(".vega-chart-wrapper.is-fullscreen")).toHaveCount(
    0,
  );
});
