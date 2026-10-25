import { test, expect } from "@playwright/test";

test("DataTable scrolls horizontally instead of overflowing a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("./cfasim-ui/charts/data-table");
  const outer = page.locator(".demo-preview .TableOuter").first();
  await expect(outer).toBeVisible();

  const box = await outer.evaluate((el) => {
    const wrapper = el.querySelector(".TableWrapper")!;
    return {
      outerRight: el.getBoundingClientRect().right,
      parentRight: el.parentElement!.getBoundingClientRect().right,
      scrollWidth: wrapper.scrollWidth,
      clientWidth: wrapper.clientWidth,
    };
  });
  expect(box.outerRight).toBeLessThanOrEqual(box.parentRight + 0.5);
  expect(box.scrollWidth).toBeGreaterThan(box.clientWidth);
});
