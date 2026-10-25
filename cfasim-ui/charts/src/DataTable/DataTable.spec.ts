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

test("DataTable sorts rows when a sortable header is clicked", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/data-table");
  const table = page
    .locator(".demo-preview .TableOuter")
    .filter({ has: page.getByRole("button", { name: "Cases" }) });
  const header = table.getByRole("columnheader", { name: "Cases" });
  const cases = table.locator("tbody tr td:nth-child(2)");

  await table.getByRole("button", { name: "Cases" }).click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(cases).toHaveText(["88", "412", "1204", "5310"]);

  await table.getByRole("button", { name: "Cases" }).press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(cases).toHaveText(["5310", "1204", "412", "88"]);

  await expect(table.getByRole("button", { name: "Rate" })).toHaveCount(0);
});

test("DataTable renders several columns through one shared cell template", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/data-table");
  const table = page
    .locator(".demo-preview .TableOuter")
    .filter({ hasText: "Stroke" });
  const row = table.locator("tbody tr").first();
  const swatches = row.locator("td span[style] > span");
  await expect(swatches).toHaveCount(2);
  await expect(swatches.nth(0)).toHaveCSS(
    "background-color",
    "rgb(158, 202, 225)",
  );
  await expect(swatches.nth(1)).toHaveCSS(
    "background-color",
    "rgb(43, 140, 190)",
  );
});

test("DataTable compact and rounded tighten cells and round the frame", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/charts/data-table");
  const wrapper = page.locator(".demo-preview .TableWrapper.rounded").first();
  const style = (sel: string, prop: string) =>
    wrapper
      .locator(sel)
      .first()
      .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  expect(
    await wrapper.evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe("6px");
  expect(
    await wrapper.evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).toBe("1px");
  // The table's own border moves out to the rounded frame.
  expect(await style("table", "border-top-width")).toBe("0px");

  const plainPad = await page
    .locator(".demo-preview .Table:not(.compact) tbody td")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
  const compactPad = await style("tbody td", "padding-top");
  expect(parseFloat(compactPad)).toBeLessThan(plainPad);
});

test("DataTable striped shades every other row", async ({ page }) => {
  await page.goto("./cfasim-ui/charts/data-table");
  const rows = page.locator(".demo-preview .Table.striped tbody tr");
  const bg = (i: number) =>
    rows
      .nth(i)
      .locator("td")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  const transparent = "rgba(0, 0, 0, 0)";
  expect(await bg(0)).toBe(transparent);
  expect(await bg(1)).not.toBe(transparent);
  expect(await bg(2)).toBe(transparent);
});
