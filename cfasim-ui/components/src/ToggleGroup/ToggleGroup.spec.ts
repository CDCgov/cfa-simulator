import { test, expect } from "@playwright/test";

test("ToggleGroup page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/toggle-group");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();

  // Single-select: the demo starts on "Weekly"; clicking another item moves
  // the pressed state to it and releases the previous one.
  const first = demos.first();
  const weekly = first.getByRole("button", { name: "Weekly", exact: true });
  const monthly = first.getByRole("button", { name: "Monthly", exact: true });
  await expect(weekly).toHaveAttribute("aria-pressed", "true");
  await monthly.click();
  await expect(monthly).toHaveAttribute("aria-pressed", "true");
  await expect(weekly).toHaveAttribute("aria-pressed", "false");
});
