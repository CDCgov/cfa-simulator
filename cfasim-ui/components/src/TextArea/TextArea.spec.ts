import { test, expect } from "@playwright/test";

test("TextArea commits on blur and the label focuses it", async ({ page }) => {
  await page.goto("./cfasim-ui/components/text-area");
  await expect(page.locator("h1")).toBeVisible();
  const demo = page.locator(".demo-preview").first();
  await demo.locator("label", { hasText: "Scenario notes" }).click({
    position: { x: 4, y: 8 },
  });
  const textarea = demo.locator("textarea");
  await expect(textarea).toBeFocused();
  await expect(page.locator(".HintContent")).toHaveCount(0);
  await textarea.fill("first line\nsecond line");
  await expect(demo.locator(".text-area-value")).toHaveText("");
  await textarea.blur();
  await expect(demo.locator(".text-area-value")).toHaveText(
    "first line\nsecond line",
  );
});
