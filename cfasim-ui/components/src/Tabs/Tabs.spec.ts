import { test, expect } from "@playwright/test";

test("Tabs scrolls a list that does not fit and masks overflow", async ({
  page,
}) => {
  await page.goto("./cfasim-ui/components/tabs");
  const list = page.getByRole("tablist", { name: "Regions" });
  await expect(list).toBeVisible();

  const fits = (name: string) =>
    list.evaluate((element, tabName) => {
      const tabs = Array.from(element.querySelectorAll("[role='tab']"));
      const tab = tabs.find((item) => item.textContent?.trim() === tabName)!;
      const tabBox = tab.getBoundingClientRect();
      const listBox = element.getBoundingClientRect();
      return (
        tabBox.left >= listBox.left - 1 && tabBox.right <= listBox.right + 1
      );
    }, name);

  const before = await list.evaluate((element) => ({
    hidden: element.scrollWidth - element.clientWidth,
    mask: getComputedStyle(element).maskImage,
  }));
  expect(before.hidden).toBeGreaterThan(0);
  expect(before.mask).toContain("linear-gradient");
  await expect(list).toHaveAttribute("data-hidden-after", "true");
  expect(await fits("Pacific")).toBe(false);

  await list.getByRole("tab", { name: "Northeast" }).focus();
  await page.keyboard.press("End");
  await expect.poll(() => fits("Pacific")).toBe(true);
  await expect(list).toHaveAttribute("data-hidden-before", "true");
  await expect(list).not.toHaveAttribute("data-hidden-after");
});
