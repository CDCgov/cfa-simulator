import { test, expect } from "@playwright/test";

test("ButtonGroup page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/button-group");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(
    demos.first().getByRole("button", { name: "Copy" }),
  ).toBeVisible();
});
