import { test, expect } from "@playwright/test";

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
