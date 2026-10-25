import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./cfasim-ui/components/date-picker");
});

const firstDemo = (page: import("@playwright/test").Page) =>
  page.locator(".demo-preview").first();

test("typing a date commits on Enter, normalized to the format", async ({
  page,
}) => {
  const demo = firstDemo(page);
  const input = demo.getByLabel("Start date");
  await expect(input).toHaveValue("2026-05-14");

  await input.fill("2026-7-4");
  await input.press("Enter");
  await expect(input).toHaveValue("2026-07-04");
  await expect(demo.getByText("Value: 2026-07-04")).toBeVisible();

  await input.fill("2026-02-30");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(demo.getByText("Value: 2026-07-04")).toBeVisible();
});

test("picking a day in the calendar sets the value and closes it", async ({
  page,
}) => {
  const demo = firstDemo(page);
  await demo.getByRole("button", { name: "Open calendar" }).click();
  const calendar = page.getByRole("application");
  await expect(calendar).toBeVisible();
  // Focus lands on the selected day so the grid is keyboard-operable.
  await expect(page.locator('[data-value="2026-05-14"]')).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(calendar).toBeHidden();
  await expect(demo.getByLabel("Start date")).toHaveValue("2026-05-15");
});

test("the month and year selects jump the calendar", async ({ page }) => {
  const demo = firstDemo(page);
  await demo.getByRole("button", { name: "Open calendar" }).click();
  const calendar = page.getByRole("application");
  await page.getByRole("combobox", { name: "Year" }).selectOption("1999");
  await page.getByRole("combobox", { name: "Month" }).selectOption("2");
  await expect(calendar).toBeVisible();

  await page.locator('[data-value="1999-02-28"]').click();
  await expect(calendar).toBeHidden();
  await expect(demo.getByLabel("Start date")).toHaveValue("1999-02-28");
});

test("custom formats round-trip through the calendar", async ({ page }) => {
  const input = page.getByLabel("US format");
  await expect(input).toHaveAttribute("placeholder", "mm/dd/yyyy");
  await page
    .locator(".demo-preview", { has: input })
    .getByRole("button", { name: "Open calendar" })
    .first()
    .click();
  await page.locator('[data-value="2026-05-01"]').click();
  await expect(input).toHaveValue("05/01/2026");

  const named = page.getByLabel("Month name");
  await named.fill("sep 3, 2026");
  await named.press("Enter");
  await expect(named).toHaveValue("Sep 3, 2026");
});

test("the month and year selects stay within min/max", async ({ page }) => {
  const demo = page.locator(".demo-preview", {
    has: page.getByLabel("Campaign start"),
  });
  await demo.getByRole("button", { name: "Open calendar" }).click();
  const year = page.getByRole("combobox", { name: "Year" });
  const month = page.getByRole("combobox", { name: "Month" });
  await expect(year.locator("option")).toHaveText(["2026"]);
  await expect(month.locator("option:not([disabled])")).toHaveText([
    "May",
    "June",
    "July",
    "August",
  ]);
  await month.selectOption("8");
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
});

test("days outside min/max are disabled", async ({ page }) => {
  const demo = page.locator(".demo-preview", {
    has: page.getByLabel("Campaign start"),
  });
  await demo.getByRole("button", { name: "Open calendar" }).click();
  await expect(page.locator('[data-value="2026-05-13"]')).toHaveAttribute(
    "data-disabled",
    "",
  );
  await expect(page.locator('[data-value="2026-05-14"]')).not.toHaveAttribute(
    "data-disabled",
  );
});

test("the clear button empties a clearable field", async ({ page }) => {
  const input = page.getByLabel("End date", { exact: true });
  const clear = page.getByRole("button", { name: "Clear End date" });
  await expect(clear).toHaveCount(0);
  await input.fill("2026-06-21");
  await input.press("Enter");
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(page.getByText('Value: ""')).toBeVisible();
});

test("a reference date converts model days to dates", async ({ page }) => {
  const input = page.getByLabel("Policy start");
  const demo = page.locator(".demo-preview", { has: input });
  await expect(input).toHaveValue("2026-06-01");
  await demo.getByRole("button", { name: "Open calendar" }).click();

  const day = page.getByRole("spinbutton", { name: "Model day" });
  await expect(day).toHaveValue("18");
  await page
    .locator(".cfasim-date-picker-content")
    .getByRole("button", { name: "More info" })
    .hover();
  await expect(page.locator(".HintContent")).toContainText(
    "Days from 2026-05-14",
  );
  // Touch users can't hover the hint, so the input carries the same text.
  await expect(day).toHaveAccessibleDescription("Days from 2026-05-14");

  await day.fill("30");
  await day.press("Enter");
  await expect(page.getByRole("application")).toBeHidden();
  await expect(input).toHaveValue("2026-06-13");
});

test("display-format shows a friendly date over an ISO value", async ({
  page,
}) => {
  const input = page.getByLabel("Report date");
  const demo = page.locator(".demo-preview", { has: input });
  await expect(input).toHaveValue("May 14, 2026");
  await input.fill("July 4, 2026");
  await input.press("Enter");
  await expect(demo.getByText("Value: 2026-07-04")).toBeVisible();

  await demo.getByRole("button", { name: "Open calendar" }).click();
  await page.locator('[data-value="2026-07-10"]').click();
  await expect(input).toHaveValue("July 10, 2026");
  await expect(demo.getByText("Value: 2026-07-10")).toBeVisible();
});
