import { test, expect } from "@playwright/test";

test("RadioGroup selects by label click and arrow keys", async ({ page }) => {
  await page.goto("./cfasim-ui/components/radio-group");
  await expect(page.locator("h1")).toBeVisible();
  const demo = page.locator(".demo-preview").first();
  const sir = demo.getByRole("radio", { name: "SIR", exact: true });
  const seir = demo.getByRole("radio", { name: "SEIR", exact: true });
  await expect(sir).toHaveAttribute("aria-checked", "true");
  // `<label for>` points at the radio, so the label text is a click target.
  await demo.locator("label", { hasText: "SEIR" }).click();
  await expect(seir).toHaveAttribute("aria-checked", "true");
  await expect(sir).toHaveAttribute("aria-checked", "false");
  // reka checks the newly focused radio only while an arrow key is held, so
  // hold the key across the focus move rather than `press` (down+up at once).
  await seir.focus();
  await page.keyboard.down("ArrowUp");
  await expect(sir).toBeFocused();
  await expect(sir).toHaveAttribute("aria-checked", "true");
  await page.keyboard.up("ArrowUp");
});
