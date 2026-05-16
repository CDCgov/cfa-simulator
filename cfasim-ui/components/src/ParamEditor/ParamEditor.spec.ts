import { test, expect, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("./cfasim-ui/components/param-editor");
  const demo = page.locator(".demo-preview").first();
  // Wait for the async editor chunk to load and CodeMirror to mount.
  await expect(demo.locator(".cm-editor")).toBeVisible();
  return demo;
}

test("edits text and emits parsed value on Apply", async ({ page }) => {
  const demo = await openDemo(page);
  await expect(demo.getByTestId("basic-output")).toContainText("beta = 0.5");

  // CodeMirror's content is a contenteditable; click it to focus, then
  // select-all and overwrite with a new JSON object.
  const content = demo.locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('{"beta": 0.42, "gamma": 0.1, "population": 10000}');
  await demo.getByRole("button", { name: "Apply" }).click();

  await expect(demo.getByTestId("basic-output")).toContainText("beta = 0.42");
});

test("Cmd/Ctrl+S applies without browser-intercepting the page-save dialog", async ({
  page,
}) => {
  const demo = await openDemo(page);
  const content = demo.locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('{"beta": 0.7, "gamma": 0.1, "population": 10000}');
  await page.keyboard.press("ControlOrMeta+s");
  await expect(demo.getByTestId("basic-output")).toContainText("beta = 0.7");
});

test("auto-applies on blur when text parses and differs", async ({ page }) => {
  const demo = await openDemo(page);
  const content = demo.locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('{"beta": 0.33, "gamma": 0.1, "population": 10000}');
  // Move focus out of the editor without clicking Apply or pressing Cmd+S.
  await demo.getByRole("combobox", { name: "Format" }).focus();
  await expect(demo.getByTestId("basic-output")).toContainText("beta = 0.33");
});

test("surfaces parse errors and does not apply", async ({ page }) => {
  const demo = await openDemo(page);
  const content = demo.locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("{ this is not valid json");
  await demo.getByRole("button", { name: "Apply" }).click();

  await expect(demo.locator(".param-editor-error")).toBeVisible();
  // Parent should still show the original value — apply was rejected.
  await expect(demo.getByTestId("basic-output")).toContainText("beta = 0.5");
});

test("exports the current text with a timestamped default filename", async ({
  page,
}) => {
  const demo = await openDemo(page);
  const downloadPromise = page.waitForEvent("download");
  await demo.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  // Default filename: params-YYYYMMDD-HHMMSS.json
  expect(download.suggestedFilename()).toMatch(/^params-\d{8}-\d{6}\.json$/);
});

test("switches format and round-trips the parsed value", async ({ page }) => {
  const demo = await openDemo(page);
  await expect(demo.locator(".cm-content")).toContainText('"beta"');
  await demo.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "YAML" }).click();
  await expect(demo.locator(".cm-content")).toContainText("beta:");
});
