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

// FieldLabel renders a span, not a for-less <label>, so the label text is
// not a click target for the Hint button it contains.
test("clicking the label text leaves the hint closed", async ({ page }) => {
  await page.goto("./cfasim-ui/components/toggle-group");
  const first = page.locator(".demo-preview").first();
  const label = first.locator(".toggle-group-label");
  const hint = label.locator(".HintTrigger");
  await expect(hint).toHaveAttribute("data-state", "closed");
  await label.click({ position: { x: 4, y: 8 } });
  await expect(hint).toHaveAttribute("data-state", "closed");
  await expect(hint).not.toBeFocused();
  await expect(page.locator(".HintContent")).toHaveCount(0);
});
