import { test, expect, type Locator } from "@playwright/test";

// Re-hover until styles settle if layout shifts under load.
async function hoverShows(row: Locator, actions: Locator) {
  await expect(async () => {
    await row.hover();
    await expect(actions).toHaveCSS("opacity", "1", { timeout: 1000 });
  }).toPass();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./cfasim-ui/components/list");
});

test("hover actions appear on hover and focus", async ({ page }) => {
  const demo = page.locator(".demo-preview").nth(3);
  const row = demo.getByRole("listitem").first();
  const action = row.getByRole("button", { name: "More actions: Counties" });
  const actions = row.locator(".ListActions");
  await expect(actions).toHaveCSS("opacity", "0");
  await hoverShows(row, actions);

  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await action.focus();
  await expect(actions).toHaveCSS("opacity", "1");
});

test("an open row menu leaves the page alone and hands off to another", async ({
  page,
}) => {
  const demo = page.locator(".demo-preview").nth(2);
  const bodyStyle = () =>
    page.evaluate(() => document.body.getAttribute("style"));
  const before = await bodyStyle();

  await demo
    .getByRole("button", { name: "Scenario actions: Baseline" })
    .click();
  await expect(page.getByRole("menu")).toBeVisible();
  expect(await bodyStyle()).toBe(before);

  await demo
    .getByRole("button", { name: "Scenario actions: School closures" })
    .click();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(
    demo.getByRole("button", { name: "Scenario actions: School closures" }),
  ).toHaveAttribute("aria-expanded", "true");
});
