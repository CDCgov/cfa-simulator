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

  // Required: clicking the pressed item leaves it pressed.
  const chart = demos
    .nth(1)
    .getByRole("button", { name: "Chart", exact: true });
  await expect(chart).toHaveAttribute("aria-pressed", "true");
  await chart.click();
  await expect(chart).toHaveAttribute("aria-pressed", "true");
  await expect(demos.nth(1)).toContainText("Selected: chart");
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

// The inset focus outline is the primary color, which the primary pressed
// fill would hide.
test("keyboard focus shows on a pressed primary item with borders", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/toggle-group");
  const pressed = page
    .getByRole("group", { name: "Bordered primary" })
    .getByRole("button", { pressed: true });
  await pressed.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(pressed).toBeFocused();
  const colors = await pressed.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineWidth: style.outlineWidth,
      outline: style.outlineColor,
      fill: style.backgroundColor,
    };
  });
  expect(colors.outlineWidth).toBe("2px");
  expect(colors.outline).not.toBe(colors.fill);
});
