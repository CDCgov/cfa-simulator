import { test, expect } from "@playwright/test";

test("Box page renders demos", async ({ page }) => {
  await page.goto("/docs/cfasim-ui/components/box");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().locator(".box")).toHaveCount(4);
  await expect(demos.first().getByText("This is an info box.")).toBeVisible();
  await expect(
    demos.first().getByText("This is a success box."),
  ).toBeVisible();
  await expect(
    demos.first().getByText("This is a warning box."),
  ).toBeVisible();
  await expect(demos.first().getByText("This is an error box.")).toBeVisible();
});
