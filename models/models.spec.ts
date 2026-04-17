import { test, expect } from "@playwright/test";

test("home page lists all models", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Models");
  const cards = page.locator(".model-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Reed-Frost Epidemic");
  await expect(cards.nth(1)).toContainText("Python Example");
  await expect(cards.nth(2)).toContainText("Fetch Example");
});

test("reed-frost model renders", async ({ page }) => {
  await page.goto("/reed-frost");
  await expect(page.locator("h1")).toContainText("Reed-Frost Epidemic");
  await expect(page.getByLabel("Population")).toBeVisible();
});

test("python example renders", async ({ page }) => {
  await page.goto("/python-example");
  await expect(page.locator("h1")).toContainText("Python Example");
  await expect(page.getByLabel("Steps")).toBeVisible();
});

test("fetch example renders", async ({ page }) => {
  await page.goto("/fetch-example");
  await expect(page.locator("h1")).toContainText("NSSP Emergency Department");
});

test("python-example syncs params to URL and hydrates from URL", async ({
  page,
}) => {
  await page.goto("/python-example?steps=25&rate=4.5");
  const stepsInput = page.getByLabel("Steps");
  const rateInput = page.getByLabel("Rate");
  await expect(stepsInput).toHaveValue("25");
  await expect(rateInput).toHaveValue("4.5");

  // Change a param and confirm it lands in the URL (300ms debounce).
  await stepsInput.fill("40");
  await stepsInput.press("Tab");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("steps"))
    .toBe("40");

  // Reset rate to default — should drop from the URL.
  await rateInput.fill("2.5");
  await rateInput.press("Tab");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("rate"))
    .toBeNull();

  // Reset button clears all query params.
  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(stepsInput).toHaveValue("10");
});
