import { test, expect } from "@playwright/test";

test("CodeMirror edits, applies on Cmd/Ctrl+S, and inherits fontSize", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/param-editor");
  const demo = page.locator(".demo-preview").first();
  await expect(demo.locator(".cm-editor")).toBeVisible();

  const content = demo.locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('{"beta": 0.7, "gamma": 0.1, "population": 10000}');
  await page.keyboard.press("ControlOrMeta+s");
  await expect(demo.getByTestId("basic-output")).toContainText("beta = 0.7");

  const sizedEditor = page.locator(".param-editor-cm .cm-editor").nth(2);
  await expect(sizedEditor).toBeVisible();
  await expect(sizedEditor).toHaveCSS("font-size", "16px");
});
