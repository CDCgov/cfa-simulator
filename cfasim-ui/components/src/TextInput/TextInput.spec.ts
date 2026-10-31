import { test, expect } from "@playwright/test";

test("TextInput page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/text-input");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("Model name")).toBeVisible();
  await expect(demos.first().locator("input")).toBeVisible();
});

// The label points at the input by `for`; wrapped, the Hint button was the
// labeled control and a label click focused it instead of the input.
test("clicking the label focuses the input", async ({ page }) => {
  await page.goto("./cfasim-ui/components/text-input");
  const demo = page.locator(".demo-preview").first();
  await demo.locator("label", { hasText: "Model name" }).click({
    position: { x: 4, y: 8 },
  });
  await expect(demo.locator("input")).toBeFocused();
  await expect(page.locator(".HintContent")).toHaveCount(0);
});
