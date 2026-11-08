import { test, expect } from "@playwright/test";

test("Checkbox page renders demos and the label toggles the box", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/checkbox");
  await expect(page.locator("h1")).toBeVisible();
  const demo = page.locator(".demo-preview").first();
  const box = demo.getByRole("checkbox", { name: "Enable vaccination" });
  await expect(box).toHaveAttribute("aria-checked", "false");
  // `<label for>` points at the checkbox, so the label text is a click target.
  await demo.getByText("Enable vaccination", { exact: true }).click();
  await expect(box).toHaveAttribute("aria-checked", "true");
  await box.press("Space");
  await expect(box).toHaveAttribute("aria-checked", "false");
});
