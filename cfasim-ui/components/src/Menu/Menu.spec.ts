import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./cfasim-ui/components/menu");
});

test("opens from the icon trigger, selects, and skips disabled options", async ({
  page,
}) => {
  const demo = page.locator(".demo-preview").first();
  const trigger = demo.getByRole("button", { name: "Scenario actions" });
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(4);
  await expect(menu.getByRole("menuitem", { name: "Archive" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(demo.getByText("Last choice: Delete")).toBeVisible();
});

test("opens from a custom trigger with links", async ({ page }) => {
  const demo = page.locator(".demo-preview").nth(1);
  await demo.getByRole("button", { name: "Series" }).click();
  const docs = page.getByRole("menuitem", { name: "Documentation" });
  await expect(docs).toHaveAttribute(
    "href",
    "https://github.com/CDCgov/cfa-simulator",
  );
});
