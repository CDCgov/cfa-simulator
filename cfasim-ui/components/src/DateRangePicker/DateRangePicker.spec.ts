import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./cfasim-ui/components/date-range-picker");
});

const firstDemo = (page: import("@playwright/test").Page) =>
  page.locator(".demo-preview").first();

test("typing dates commits each end, and an inverted range is rejected", async ({
  page,
}) => {
  const demo = firstDemo(page);
  const group = demo.getByRole("group", { name: "Simulation window" });
  const start = group.getByRole("textbox", { name: "Start date" });
  const end = group.getByRole("textbox", { name: "End date" });
  await expect(start).toHaveValue("2026-05-14");
  await expect(end).toHaveValue("2026-06-30");

  await start.fill("2026-6-1");
  await start.press("Enter");
  await expect(start).toHaveValue("2026-06-01");
  await expect(demo.getByText("Start: 2026-06-01")).toBeVisible();

  await end.fill("2026-05-01");
  await end.press("Enter");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(
    demo.getByText("The end date must be on or after the start date"),
  ).toBeVisible();
  await expect(demo.getByText("end: 2026-06-30")).toBeVisible();
});

test("picking two days in the calendar sets the range and closes it", async ({
  page,
}) => {
  const demo = firstDemo(page);
  await demo.getByRole("button", { name: "Open calendar" }).click();
  const calendar = page.getByRole("application");
  await expect(calendar).toBeVisible();
  await expect(page.locator('[data-value="2026-05-14"]')).toHaveAttribute(
    "data-selection-start",
    "true",
  );

  await page.locator('[data-value="2026-05-20"]').click();
  // Hovering previews the range before the end is picked.
  await page.locator('[data-value="2026-05-25"]').hover();
  await expect(page.locator('[data-value="2026-05-22"]')).toHaveAttribute(
    "data-highlighted",
    "",
  );
  await expect(calendar).toBeVisible();

  await page.locator('[data-value="2026-05-25"]').click();
  await expect(calendar).toBeHidden();
  await expect(demo.getByRole("textbox", { name: "Start date" })).toHaveValue(
    "2026-05-20",
  );
  await expect(demo.getByRole("textbox", { name: "End date" })).toHaveValue(
    "2026-05-25",
  );
});

test("the keyboard picks a range", async ({ page }) => {
  const demo = firstDemo(page);
  await demo.getByRole("button", { name: "Open calendar" }).click();
  await expect(page.locator('[data-value="2026-05-14"]')).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("application")).toBeHidden();
  await expect(
    demo.getByText("Start: 2026-05-14, end: 2026-05-21"),
  ).toBeVisible();
});

test("min and max disable days outside the bounds", async ({ page }) => {
  const demo = page.locator(".demo-preview").nth(3);
  await demo.getByRole("button", { name: "Open calendar" }).click();
  await page.getByRole("combobox", { name: "Month" }).selectOption("5");
  await expect(page.locator('[data-value="2026-05-13"]')).toHaveAttribute(
    "data-disabled",
    "",
  );
});
