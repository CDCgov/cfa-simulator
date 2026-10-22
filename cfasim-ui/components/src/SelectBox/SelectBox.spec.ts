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

test("SelectBox autocomplete clears via the clear button", async ({ page }) => {
  await page.goto("./cfasim-ui/components/select-box");
  const demo = page.locator(".demo-preview", {
    has: page.locator(".select-input"),
  });
  const input = demo.locator(".select-input").first();
  const clear = demo.getByRole("button", { name: "Clear" });

  await expect(clear).toHaveCount(0);
  await input.click();
  await page.getByRole("option", { name: "Texas" }).click();
  await expect(input).toHaveValue("Texas");

  await clear.click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(clear).toHaveCount(0);
  // Nothing is selected any more, so the list shows no check mark.
  await input.click();
  await expect(page.getByRole("option", { name: "Texas" })).toHaveAttribute(
    "aria-selected",
    "false",
  );
});

test("SelectBox autocomplete clears when the text is deleted", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/select-box");
  const demo = page.locator(".demo-preview", {
    has: page.locator(".select-input"),
  });
  const input = demo.locator(".select-input").first();

  await input.click();
  await page.getByRole("option", { name: "Florida" }).click();
  await expect(input).toHaveValue("Florida");

  // Select all and delete, then leave the field: the label must not come back.
  await input.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Escape");
  await page.locator("h1").click();
  await expect(input).toHaveValue("");

  // Picking again after clearing still works.
  await input.click();
  await page.getByRole("option", { name: "Washington" }).click();
  await expect(input).toHaveValue("Washington");
});

test("SelectBox autocomplete keeps a required value", async ({ page }) => {
  await page.goto("./cfasim-ui/components/select-box");
  const demo = page.locator(".demo-preview", {
    has: page.locator(".select-input[aria-required='true']"),
  });
  const input = demo.locator(".select-input");

  await expect(input).toHaveValue("Daily");
  await expect(demo.getByRole("button", { name: "Clear" })).toHaveCount(0);

  await input.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Escape");
  await page.locator("h1").click();
  // The selection survives and its label comes back.
  await expect(input).toHaveValue("Daily");
});
