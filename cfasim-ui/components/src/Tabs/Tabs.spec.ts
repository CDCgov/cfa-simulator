import { test, expect } from "@playwright/test";

test("Tabs switches the active tab", async ({ page }) => {
  await page.goto("./cfasim-ui/components/tabs");
  const demo = page.locator(".demo-preview").first();
  const data = demo.getByRole("tab", { name: "Data" });
  await data.click();
  await expect(data).toHaveAttribute("data-state", "active");
  await expect(demo.getByText("Active tab: data")).toBeVisible();
});

test("Tabs scrolls a list that does not fit", async ({ page }) => {
  await page.goto("./cfasim-ui/components/tabs");
  const list = page.getByRole("tablist", { name: "Regions" });
  await expect(list).toBeVisible();

  const scroll = () =>
    list.evaluate((el) => ({
      left: el.scrollLeft,
      hidden: el.scrollWidth - el.clientWidth,
      mask: getComputedStyle(el).maskImage,
    }));
  const fits = (name: string) =>
    list.evaluate((el, tabName) => {
      const tabs = Array.from(el.querySelectorAll("[role='tab']"));
      const tab = tabs.find((item) => item.textContent?.trim() === tabName)!;
      const tabBox = tab.getBoundingClientRect();
      const listBox = el.getBoundingClientRect();
      // Subpixel tab widths: allow a pixel of rounding at the edges.
      return (
        tabBox.left >= listBox.left - 1 && tabBox.right <= listBox.right + 1
      );
    }, name);

  const before = await scroll();
  expect(before.hidden).toBeGreaterThan(0);
  expect(before.left).toBe(0);
  await expect(list).toHaveAttribute("data-hidden-after", "true");
  await expect(list).not.toHaveAttribute("data-hidden-before");
  expect(before.mask).toContain("linear-gradient");
  expect(await fits("Pacific")).toBe(false);

  // Keyboard: End moves to the last tab, which scrolls into view.
  await list.getByRole("tab", { name: "Northeast" }).focus();
  await page.keyboard.press("End");
  const pacific = list.getByRole("tab", { name: "Pacific" });
  await expect(pacific).toHaveAttribute("data-state", "active");
  await expect.poll(() => fits("Pacific")).toBe(true);
  await expect(list).toHaveAttribute("data-hidden-before", "true");
  await expect(list).not.toHaveAttribute("data-hidden-after");
});

test("Tabs keeps its scroll position when the list resizes", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/tabs");
  const list = page.getByRole("tablist", { name: "Regions" });
  await expect(list).toHaveAttribute("data-hidden-after", "true");

  // Look at later tabs without selecting one, then narrow the list.
  await list.evaluate((el) => {
    el.scrollLeft = 200;
  });
  await expect(list).toHaveAttribute("data-hidden-before", "true");
  await list.evaluate((el) => {
    el.closest<HTMLElement>("[style*='max-width']")!.style.maxWidth = "260px";
  });
  await expect.poll(() => list.evaluate((el) => el.clientWidth)).toBe(260);
  expect(await list.evaluate((el) => el.scrollLeft)).toBe(200);
});
