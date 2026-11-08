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

test("PriorInput keeps four params on one row of equal columns", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/prior-input");
  const demo = page.locator(".demo-preview").first();
  await demo.getByRole("combobox", { name: "Family" }).click();
  await page.getByRole("option", { name: "TruncatedNormal" }).click();
  const inputs = await Promise.all(
    ["loc", "scale", "low", "high"].map((n) =>
      demo.getByLabel(n, { exact: true }).boundingBox(),
    ),
  );
  for (const box of inputs) {
    expect(Math.abs(box!.y - inputs[0]!.y)).toBeLessThan(1);
    expect(Math.abs(box!.width - inputs[0]!.width)).toBeLessThan(1);
  }
  const group = await demo.locator(".prior-group").boundingBox();
  expect(inputs[3]!.x + inputs[3]!.width).toBeLessThanOrEqual(
    group!.x + group!.width + 1,
  );
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

test("PriorInput compact layout puts the family and params in equal columns", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/prior-input#compact-layout");
  const field = page.locator(".prior-input[data-layout='compact']", {
    hasText: "R0 prior",
  });
  await expect(field).toBeVisible();
  // The web font swap and the hash scroll both move the page after first
  // layout; measure everything at once after the fonts are in, or the label
  // measured last compares against fields measured before the shift.
  await page.evaluate(() => document.fonts.ready);
  const family = field.getByRole("combobox", { name: "Family" });
  const loc = field.getByLabel("loc", { exact: true });
  const scale = field.getByLabel("scale", { exact: true });
  const [f, l, s, fieldLabel, locLabel, preview, summary] = await Promise.all(
    [
      family,
      loc,
      scale,
      field.getByText("R0 prior", { exact: true }),
      field.locator("label", { hasText: "loc" }),
      field.locator("svg.prior-preview"),
      field.locator(".prior-summary"),
    ].map((c) => c.boundingBox()),
  );
  // Same row, same width, left to right.
  expect(Math.abs(l!.y - f!.y)).toBeLessThan(1);
  expect(Math.abs(s!.y - f!.y)).toBeLessThan(1);
  expect(Math.abs(l!.width - f!.width)).toBeLessThan(1);
  expect(Math.abs(s!.width - f!.width)).toBeLessThan(1);
  expect(l!.x).toBeGreaterThan(f!.x + f!.width - 1);
  expect(s!.x).toBeGreaterThan(l!.x + l!.width - 1);
  // The field label spans above the row, parameter names sit beneath their
  // fields, and the preview and summary follow the row.
  expect(fieldLabel!.y + fieldLabel!.height).toBeLessThanOrEqual(f!.y);
  expect(fieldLabel!.width).toBeGreaterThan(f!.width * 2);
  expect(locLabel!.y).toBeGreaterThanOrEqual(l!.y + l!.height);
  expect(Math.abs(locLabel!.x - l!.x)).toBeLessThan(1);
  expect(preview!.y).toBeGreaterThanOrEqual(locLabel!.y + locLabel!.height);
  expect(Math.abs(preview!.x - f!.x)).toBeLessThan(1);
  expect(Math.abs(preview!.width - (s!.x + s!.width - f!.x))).toBeLessThan(1);
  expect(summary!.y).toBeGreaterThanOrEqual(preview!.y + preview!.height);
});

test("PriorInput compact layout gives four params their own row", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/prior-input#compact-layout");
  const field = page.locator(".prior-input[data-layout='compact']", {
    hasText: "Reporting delay",
  });
  const family = await field
    .getByRole("combobox", { name: "Family" })
    .boundingBox();
  const inputs = await Promise.all(
    ["loc", "scale", "low", "high"].map((n) =>
      field.getByLabel(n, { exact: true }).boundingBox(),
    ),
  );
  const group = await field.locator(".prior-group").boundingBox();
  expect(Math.abs(family!.width - group!.width)).toBeLessThan(1);
  for (const box of inputs) {
    expect(box!.y).toBeGreaterThanOrEqual(family!.y + family!.height);
    expect(Math.abs(box!.y - inputs[0]!.y)).toBeLessThan(1);
    expect(Math.abs(box!.width - inputs[0]!.width)).toBeLessThan(1);
  }
  expect(inputs[3]!.x + inputs[3]!.width).toBeLessThanOrEqual(
    group!.x + group!.width + 1,
  );
});
