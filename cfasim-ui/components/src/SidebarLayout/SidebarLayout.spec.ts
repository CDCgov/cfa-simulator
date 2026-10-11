import { test, expect } from "@playwright/test";

test.describe("SidebarLayout full-window demo", () => {
  test.use({ viewport: { width: 900, height: 480 } });

  test("the document never scrolls, only the panes do", async ({ page }) => {
    await page.goto("./demos/sidebar-layout/index.html");
    await expect(page.locator("h1")).toHaveText("SidebarLayout Demo");

    // Both hide-label inputs sit below the fold of their pane. Their
    // visually-hidden labels are absolutely positioned and must not extend
    // the document past the viewport.
    const main = page.getByTestId("main-hidden-label");
    const sidebar = page.getByTestId("sidebar-hidden-label");
    await expect(main).toBeAttached();
    await expect(sidebar).toBeAttached();

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollHeight - window.innerHeight,
      main: document.querySelector(".MainScroll")!.scrollHeight,
      mainVisible: document.querySelector(".MainScroll")!.clientHeight,
    }));
    expect(overflow.document).toBe(0);
    expect(overflow.main).toBeGreaterThan(overflow.mainVisible);

    await page.mouse.move(600, 300);
    await page.mouse.wheel(0, 5000);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("combobox", { name: "Metric" })).toBeVisible();
  });
});
