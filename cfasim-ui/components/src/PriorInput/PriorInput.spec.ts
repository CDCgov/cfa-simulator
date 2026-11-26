import { test, expect } from "@playwright/test";

test("compact layout aligns family and params in equal columns", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/prior-input#compact-layout");
  const field = page.locator(".prior-input[data-layout='compact']", {
    hasText: "R0 prior",
  });
  await expect(field).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const [family, loc, scale, preview] = await Promise.all(
    [
      field.getByRole("combobox", { name: "Family" }),
      field.getByLabel("loc", { exact: true }),
      field.getByLabel("scale", { exact: true }),
      field.locator("svg.prior-preview"),
    ].map((locator) => locator.boundingBox()),
  );
  expect(Math.abs(loc!.y - family!.y)).toBeLessThan(1);
  expect(Math.abs(scale!.y - family!.y)).toBeLessThan(1);
  expect(Math.abs(loc!.width - family!.width)).toBeLessThan(1);
  expect(Math.abs(scale!.width - family!.width)).toBeLessThan(1);
  expect(
    Math.abs(preview!.width - (scale!.x + scale!.width - family!.x)),
  ).toBeLessThan(1);
});
