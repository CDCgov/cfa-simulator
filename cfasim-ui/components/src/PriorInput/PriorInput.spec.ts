import { test, expect } from "@playwright/test";

test("PriorInput page renders demos", async ({ page }) => {
  await page.goto("./cfasim-ui/components/prior-input");
  await expect(page.locator("h1")).toBeVisible();
  const demo = page.locator(".demo-preview").first();
  await expect(demo.getByText("R0 prior")).toBeVisible();
  await expect(demo.locator("pre.prior-output")).toContainText(
    '"family": "Normal"',
  );
});

test("PriorInput switches family and edits a parameter", async ({ page }) => {
  await page.goto("./cfasim-ui/components/prior-input");
  const demo = page.locator(".demo-preview").first();
  const output = demo.locator("pre.prior-output");

  await demo.getByRole("combobox", { name: "Family" }).click();
  await page.getByRole("option", { name: "Gamma", exact: true }).click();
  await expect(output).toContainText('"family": "Gamma"');
  await expect(output).toContainText('"concentration": 2');

  // NumberInput commits on blur.
  const rate = demo.getByLabel("rate", { exact: true });
  await rate.fill("3");
  await rate.blur();
  await expect(output).toContainText('"rate": 3');
  await expect(output).toContainText('"concentration": 2');
});

test("PriorInput offers alternative parameterizations and integer fields", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/prior-input");
  const demo = page.locator(".demo-preview", {
    hasText: "Rust prior",
  });
  const output = demo.locator("pre.prior-output");
  await expect(output).toHaveText('{"type":"Exponential","scale":2}');

  await demo.getByRole("combobox", { name: "Family" }).click();
  await page.getByRole("option", { name: "Exponential (rate)" }).click();
  await expect(output).toHaveText('{"type":"Exponential","rate":1}');

  await demo.getByRole("combobox", { name: "Family" }).click();
  await page.getByRole("option", { name: "DiscreteUniform" }).click();
  const low = demo.getByLabel("low", { exact: true });
  await expect(low).toHaveAttribute("inputmode", "numeric");
  await low.fill("2.7");
  await low.blur();
  await expect(output).toHaveText(
    '{"type":"DiscreteUniform","low":2,"high":6}',
  );
});
