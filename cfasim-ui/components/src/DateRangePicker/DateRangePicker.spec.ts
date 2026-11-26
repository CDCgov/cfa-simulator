import { test, expect } from "@playwright/test";

test("picking two days in the calendar previews on hover and closes", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/date-range-picker");
  const demo = page.locator(".demo-preview").first();
  await demo.getByRole("button", { name: "Open calendar" }).click();
  const calendar = page.getByRole("application");
  await expect(calendar).toBeVisible();
  await expect(page.locator('[data-value="2026-05-14"]')).toBeFocused();

  await page.locator('[data-value="2026-05-20"]').click();
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
