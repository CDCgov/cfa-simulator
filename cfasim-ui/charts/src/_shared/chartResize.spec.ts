import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * The media rule of the theme's reset (`theme/src/base.css`), which the
 * docs site does not load. It shrinks a chart's svg, and so its wrapper,
 * until the chart draws at the narrower width.
 */
const THEME_SVG_RESET = `
  @layer base {
    svg {
      max-width: 100%;
      display: block;
      height: auto;
    }
  }
`;

const VIEWPORT_HEIGHT = 1000;
const VIEWPORT_WIDTHS = [1280, 700, 1400, 900, 1280];

declare global {
  interface Window {
    resizeObserverErrors: string[];
  }
}

/** Chromium reports the loop as a window `error` event, not an exception. */
async function collectResizeObserverErrors(page: Page) {
  await page.addInitScript(() => {
    window.resizeObserverErrors = [];
    window.addEventListener("error", (event) => {
      if (event.message.includes("ResizeObserver")) {
        window.resizeObserverErrors.push(event.message);
      }
    });
  });
}

function resizeObserverErrors(page: Page) {
  return page.evaluate(() => window.resizeObserverErrors);
}

/** Lets the observers deliver and the charts render. */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

async function svgSize(chart: Locator) {
  const svg = chart.locator(":scope > svg");
  return {
    width: Number(await svg.getAttribute("width")),
    height: Number(await svg.getAttribute("height")),
  };
}

for (const { name, path, wrapper } of [
  {
    name: "LineChart",
    path: "./cfasim-ui/charts/line-chart",
    wrapper: ".line-chart-wrapper",
  },
  {
    name: "BarChart",
    path: "./cfasim-ui/charts/bar-chart",
    wrapper: ".bar-chart-wrapper",
  },
]) {
  test(`${name} follows the viewport under the theme reset without a ResizeObserver loop`, async ({
    page,
  }) => {
    await collectResizeObserverErrors(page);
    await page.setViewportSize({
      width: VIEWPORT_WIDTHS[0],
      height: VIEWPORT_HEIGHT,
    });
    await page.goto(path);
    await page.addStyleTag({ content: THEME_SVG_RESET });
    const chart = page.locator(wrapper).first();
    await expect(chart).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const drawnWidths = new Set<number>();
    for (const width of VIEWPORT_WIDTHS.slice(1)) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await settle(page);
      const box = await chart.boundingBox();
      const drawn = await svgSize(chart);
      expect(drawn.width).toBeCloseTo(box!.width, 0);
      drawnWidths.add(Math.round(drawn.width));
    }

    expect(drawnWidths.size).toBeGreaterThan(1);
    expect(await resizeObserverErrors(page)).toEqual([]);
  });
}

test("LineChart grows for another row of section labels without a ResizeObserver loop", async ({
  page,
}) => {
  await collectResizeObserverErrors(page);
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page
    .locator(".line-chart-wrapper", { hasText: "Rapid growth phase" })
    .first();
  await expect(chart).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const wide = await svgSize(chart);

  // Too narrow for the two section labels to share a row.
  await chart.evaluate((element) => {
    element.parentElement!.style.width = "220px";
  });
  await settle(page);

  const narrow = await svgSize(chart);
  expect(narrow.width).toBeLessThan(wide.width);
  expect(narrow.height).toBeGreaterThan(wide.height);
  expect(await resizeObserverErrors(page)).toEqual([]);
});

for (const { name, style } of [
  { name: "a flex row", style: { display: "flex" } },
  { name: "a grid", style: { display: "grid" } },
  { name: "padded", style: { padding: "20px", boxSizing: "border-box" } },
]) {
  test(`a chart follows a wrapper that a consumer's class makes ${name}`, async ({
    page,
  }) => {
    await page.goto("./cfasim-ui/charts/line-chart");
    const chart = page.locator(".line-chart-wrapper").first();
    await expect(chart).toBeVisible();
    await chart.evaluate((element, wrapperStyle) => {
      Object.assign((element as HTMLElement).style, wrapperStyle);
    }, style);

    for (const width of [520, 340]) {
      await chart.evaluate((element, parentWidth) => {
        element.parentElement!.style.width = `${parentWidth}px`;
      }, width);
      await settle(page);
      const contentWidth = await chart.evaluate((element) => {
        const computed = getComputedStyle(element);
        return (
          element.clientWidth -
          parseFloat(computed.paddingLeft) -
          parseFloat(computed.paddingRight)
        );
      });
      expect(contentWidth).toBeLessThanOrEqual(width);
      expect((await svgSize(chart)).width).toBeCloseTo(contentWidth, 0);
    }
  });
}

test("an expanded chart fills the window, follows it, and returns to its inline size", async ({
  page,
}) => {
  await collectResizeObserverErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./cfasim-ui/charts/line-chart");
  const chart = page.locator(".line-chart-wrapper").first();
  await expect(chart).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  const inline = await svgSize(chart);

  await chart.getByRole("button", { name: "Chart options" }).click();
  await page.getByRole("menuitem", { name: "Fullscreen" }).click();
  const expanded = page.locator(".line-chart-wrapper.is-fullscreen");
  await expect(expanded).toBeVisible();

  // The wrapper pads the chart by 2em on each side.
  const padding = await expanded.evaluate(
    (element) => 2 * parseFloat(getComputedStyle(element).paddingTop),
  );
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 900, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await settle(page);
    const drawn = await svgSize(expanded);
    expect(drawn.width).toBeCloseTo(viewport.width - padding, 0);
    expect(drawn.height).toBeCloseTo(viewport.height - padding, 0);
  }

  await page.keyboard.press("Escape");
  await expect(expanded).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await settle(page);
  expect(await svgSize(chart)).toEqual(inline);
  expect(await resizeObserverErrors(page)).toEqual([]);
});
