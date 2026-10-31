import { test, expect } from "@playwright/test";

test("Button page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/button");
  await expect(page.locator("h1")).toBeVisible();
  const demos = page.locator(".demo-preview");
  await expect(demos.first()).toBeVisible();
  await expect(
    demos.first().getByRole("button", { name: "Primary" }),
  ).toBeVisible();
  await expect(
    demos.first().getByRole("button", { name: "Secondary" }),
  ).toBeVisible();

  // Disabled demo
  const disabledDemo = demos.nth(1);
  await expect(disabledDemo.getByRole("button").first()).toBeDisabled();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`keyboard focus draws the theme focus ring (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("./cfasim-ui/components/button");
    const button = page
      .locator(".demo-preview")
      .first()
      .getByRole("button", { name: "Primary" });
    await button.focus();
    await expect(button).toHaveCSS(
      "box-shadow",
      colorScheme === "light"
        ? "rgba(0, 102, 255, 0.2) 0px 0px 0px 3px"
        : "rgba(77, 148, 255, 0.3) 0px 0px 0px 3px",
    );
  });
}
