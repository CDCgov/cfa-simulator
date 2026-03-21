import { test, expect } from "@playwright/test";

const BASE = "/docs/cfasim-ui";

function demoTest(
  name: string,
  section: string,
  slug: string,
  checks: (args: {
    page: import("@playwright/test").Page;
    demos: import("@playwright/test").Locator;
  }) => Promise<void>,
) {
  test(`${name} page renders demos`, async ({ page }) => {
    await page.goto(`${BASE}/${section}/${slug}`);
    await expect(page.locator("h1")).toBeVisible();
    const demos = page.locator(".demo-preview");
    await expect(demos.first()).toBeVisible();
    await checks({ page, demos });
  });
}

demoTest("Box", "components", "box", async ({ demos }) => {
  await expect(demos.first().locator(".box")).toHaveCount(4);
  await expect(demos.first().getByText("This is an info box.")).toBeVisible();
  await expect(
    demos.first().getByText("This is a success box."),
  ).toBeVisible();
  await expect(
    demos.first().getByText("This is a warning box."),
  ).toBeVisible();
  await expect(demos.first().getByText("This is an error box.")).toBeVisible();
});

demoTest("Button", "components", "button", async ({ demos }) => {
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

demoTest("Expander", "components", "expander", async ({ page, demos }) => {
  const trigger = demos.first().getByText("Show advanced options");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(
    demos.first().getByText("Here is the hidden content."),
  ).toBeVisible();
});

demoTest("Hint", "components", "hint", async ({ demos }) => {
  await expect(demos.first().getByText("Population size")).toBeVisible();
  await expect(
    demos.first().getByRole("button", { name: "More info" }),
  ).toBeVisible();
});

demoTest("Icon", "components", "icon", async ({ demos }) => {
  // Sizes demo should have 3 icon spans (with aria-label, so role="img")
  await expect(demos.first().locator(".Icon")).toHaveCount(3);
});

demoTest("NumberInput", "components", "number-input", async ({ demos }) => {
  await expect(demos.first().getByText("Days")).toBeVisible();
  await expect(demos.first().locator('input[type="number"]')).toBeVisible();
});

demoTest("SelectBox", "components", "select-box", async ({ demos }) => {
  await expect(demos.first().getByText("Interval")).toBeVisible();
});

demoTest("Spinner", "components", "spinner", async ({ demos }) => {
  await expect(demos.first().locator('[role="status"]')).toHaveCount(3);
});

demoTest("TextInput", "components", "text-input", async ({ demos }) => {
  await expect(demos.first().getByText("Model name")).toBeVisible();
  await expect(demos.first().locator("input")).toBeVisible();
});

demoTest("Toggle", "components", "toggle", async ({ demos }) => {
  const toggle = demos.first().getByRole("switch");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("data-state", "unchecked");
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-state", "checked");
});

demoTest("LineChart", "charts", "line-chart", async ({ demos }) => {
  // Each demo should render an SVG with path elements
  await expect(demos.first().locator("svg")).toBeVisible();
  await expect(demos.first().locator("svg path")).toBeAttached();
});
