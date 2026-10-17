import { test, expect } from "@playwright/test";

test("app renders and a run produces output", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "{{ project_name }}" }),
  ).toBeVisible();
  await expect(page.getByLabel("Steps")).toBeVisible();
  await expect(page.getByLabel("Rate")).toBeVisible();

  // The Run button enables once the page has reached the server.
  const run = page.getByRole("button", { name: "Run", exact: true });
  await expect(run).toBeEnabled({ timeout: 30_000 });
  await run.click();

  // The task runs on the server; its outputs stream back and draw the chart.
  await expect(page.locator("svg path").first()).toBeVisible({
    timeout: 30_000,
  });
});

test("params sync to and hydrate from the URL", async ({ page }) => {
  await page.goto("/?steps=15&rate=3");
  await expect(page.getByLabel("Steps")).toHaveValue("15");
  await expect(page.getByLabel("Rate")).toHaveValue("3");
});
