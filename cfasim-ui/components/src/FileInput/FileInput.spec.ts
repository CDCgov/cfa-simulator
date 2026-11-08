import { test, expect } from "@playwright/test";

test("FileInput takes a file from the dialog and clears it", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/file-input");
  await expect(page.locator("h1")).toBeVisible();
  const demo = page.locator(".demo-preview").first();
  // Named by the field label (with its hint button) plus the button text.
  const button = demo.getByRole("button", { name: /^Case data.*Choose file$/ });
  const chooserPromise = page.waitForEvent("filechooser");
  await button.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(new URL("./cases.csv", import.meta.url).pathname);
  await expect(demo.locator(".file-input-summary")).toHaveText("cases.csv");
  await expect(demo.locator(".file-input-preview")).toContainText(
    "4 lines, first: date,cases",
  );
  await demo.getByRole("button", { name: "Clear selected files" }).click();
  await expect(demo.locator(".file-input-summary")).toHaveText(
    "No file chosen",
  );
});
