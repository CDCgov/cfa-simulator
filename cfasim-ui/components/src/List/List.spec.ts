import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./cfasim-ui/components/list");
});

test("collapses and runs header and item actions", async ({ page }) => {
  const demo = page.locator(".demo-preview").nth(1);
  const items = demo.getByRole("list", { name: "Scenarios" });
  await expect(items.getByRole("listitem")).toHaveCount(3);

  await demo.getByRole("button", { name: "Add scenario" }).click();
  await expect(items.getByRole("listitem")).toHaveCount(4);

  await demo.getByRole("button", { name: "More actions: Baseline" }).click();
  await expect(demo.getByText("Last item action: Baseline")).toBeVisible();

  const toggle = demo.getByRole("button", { name: "Scenarios" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(items).toBeHidden();
  await toggle.click();
  await expect(items).toBeVisible();
});

test("hover actions appear on hover and focus", async ({ page }) => {
  const demo = page.locator(".demo-preview").nth(3);
  const row = demo.getByRole("listitem").first();
  const action = row.getByRole("button", { name: "More actions: Counties" });
  const actions = row.locator(".ListActions");
  await expect(actions).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(actions).toHaveCSS("opacity", "1");

  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await action.focus();
  await expect(actions).toHaveCSS("opacity", "1");
});

test("custom action slot content hides with hover visibility", async ({
  page,
}) => {
  const demo = page.locator(".demo-preview").nth(7);
  const row = demo.getByRole("listitem").first();
  const actions = row.locator(".ListActions");
  await expect(actions).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(
    row.getByRole("button", { name: "Edit Counties" }),
  ).toBeVisible();
  await expect(actions).toHaveCSS("opacity", "1");
});

test("selects rows without the item action selecting", async ({ page }) => {
  const demo = page.locator(".demo-preview").nth(5);
  const rows = demo.getByRole("listitem");
  await expect(rows.nth(0)).toHaveAttribute("data-selected", "true");

  await rows.nth(1).click({ position: { x: 4, y: 4 } });
  await expect(rows.nth(1)).toHaveAttribute("data-selected", "true");
  await expect(
    demo.getByRole("button", { name: "School closures", exact: true }),
  ).toHaveAttribute("aria-current", "true");

  await demo
    .getByRole("button", { name: "More actions: No intervention" })
    .click();
  await expect(rows.nth(1)).toHaveAttribute("data-selected", "true");

  await rows.nth(2).click({ force: true });
  await expect(rows.nth(1)).toHaveAttribute("data-selected", "true");
});

test("row and header actions open menus", async ({ page }) => {
  const demo = page.locator(".demo-preview").nth(2);
  const rows = demo.getByRole("listitem");
  await expect(rows).toHaveCount(2);

  await demo
    .getByRole("button", { name: "Scenario actions: Baseline" })
    .click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(3);
  await page.mouse.move(0, 0);
  await expect(rows.first().locator(".ListActions")).toHaveCSS("opacity", "1");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(
    demo.getByText("Last choice: Duplicate: Baseline"),
  ).toBeVisible();
  await expect(rows).toHaveCount(3);

  await demo
    .getByRole("button", { name: "Scenario actions: Baseline copy" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(rows).toHaveCount(2);

  await demo.getByRole("button", { name: "New scenario" }).click();
  await page.getByRole("menuitem", { name: "Blank scenario" }).click();
  await expect(rows).toHaveCount(3);
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
  await expect(demo.getByRole("listitem")).toHaveCount(2);

  await demo
    .getByRole("button", { name: "Scenario actions: School closures" })
    .click();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(
    demo.getByRole("button", { name: "Scenario actions: School closures" }),
  ).toHaveAttribute("aria-expanded", "true");
});
