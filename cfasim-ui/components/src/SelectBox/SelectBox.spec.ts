import { test, expect } from "@playwright/test";

test("SelectBox page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/select-box");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(demos.first().getByText("Interval")).toBeVisible();
});

test("SelectBox autocomplete filters and selects an option", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/select-box");
  const demo = page.locator(".demo-preview", {
    has: page.locator(".select-input"),
  });
  const input = demo.locator(".select-input").first();

  await input.click();
  await input.fill("tex");
  await expect(page.getByRole("option", { name: "Texas" })).toBeVisible();
  await expect(page.getByRole("option", { name: "California" })).toHaveCount(0);

  await page.getByRole("option", { name: "Texas" }).click();
  // The selected label fills the input and the list collapses.
  await expect(input).toHaveValue("Texas");
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("SelectBox autocomplete is operable by keyboard", async ({ page }) => {
  await page.goto("./cfasim-ui/components/select-box");
  const demo = page.locator(".demo-preview", {
    has: page.locator(".select-input"),
  });
  const input = demo.locator(".select-input").first();

  // The combobox exposes the ARIA combobox pattern.
  await expect(input).toHaveRole("combobox");
  await expect(input).toHaveAttribute("aria-autocomplete", "list");

  await input.click();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("listbox")).toBeVisible();

  // Filter, then pick the highlighted option with the keyboard only.
  await input.fill("wash");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("Washington");
  await expect(input).toHaveAttribute("aria-expanded", "false");
});
