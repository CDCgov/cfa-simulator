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
