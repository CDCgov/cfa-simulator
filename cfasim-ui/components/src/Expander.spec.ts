import { test, expect } from "@playwright/test";

test("Expander page renders demos", async ({ page }) => {
  await page.goto("/docs/cfasim-ui/components/expander");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  const trigger = demos.first().getByText("Show advanced options");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(
    demos.first().getByText("Here is the hidden content."),
  ).toBeVisible();
});
