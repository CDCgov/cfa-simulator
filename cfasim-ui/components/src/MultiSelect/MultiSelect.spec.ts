import { test, expect } from "@playwright/test";

test("MultiSelect page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/multi-select");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("States")).toBeVisible();
});

test("MultiSelect filters and selects options", async ({ page }) => {
  await page.goto("./cfasim-ui/components/multi-select");
  const demo = page.locator(".demo-preview").first();
  const input = demo.locator(".multi-select-input").first();

  await input.click();
  await input.fill("new");
  // Only the matching option remains in the filtered list.
  await expect(page.getByRole("option", { name: "New York" })).toBeVisible();
  await expect(page.getByRole("option", { name: "California" })).toHaveCount(0);

  await page.getByRole("option", { name: "New York" }).click();
  await expect(
    demo.locator(".multi-select-chip", { hasText: "New York" }),
  ).toBeVisible();
  // The typed text clears once an option is selected.
  await expect(input).toHaveValue("");
  await expect(page.getByRole("option", { name: "California" })).toBeVisible();
});
