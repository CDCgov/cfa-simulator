import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

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

test.describe("SidebarLayout sidebar on a small phone", () => {
  // Narrower than the 400px sidebar.
  test.use({ viewport: { width: 360, height: 600 } });

  test("the open sidebar fits the screen and the page does not scroll sideways", async ({
    page,
  }) => {
    await page.goto("./demos/sidebar-layout/index.html");
    await expect(page.locator("h1")).toHaveText("SidebarLayout Demo");
    const panes = () =>
      page.evaluate(() => ({
        rail: document
          .querySelector(".SidebarRail")!
          .getBoundingClientRect()
          .toJSON(),
        main: document.querySelector(".Main")!.getBoundingClientRect().toJSON(),
        documentWidth: document.documentElement.scrollWidth,
      }));

    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect
      .poll(panes)
      .toMatchObject({ rail: { x: 0, width: 360 }, documentWidth: 360 });
    await expect(
      page.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Reset" })).toBeInViewport({
      ratio: 1,
    });

    // Tabbing past the end of the sidebar into the main pane, now off screen,
    // brings it back.
    await page.getByPlaceholder("Notes").click();
    await page.keyboard.press("Tab");
    await expect
      .poll(panes)
      .toMatchObject({ main: { x: 0, width: 360 }, documentWidth: 360 });
    await expect(
      page.getByRole("button", { name: /Switch to (dark|light) mode/ }),
    ).toBeFocused();
  });
});

test.describe("SidebarLayout tabs on a phone", () => {
  test.use({ viewport: { width: 375, height: 600 } });

  test("the tabs take their own row and the bar fits the screen", async ({
    page,
  }) => {
    await page.goto("./demos/sidebar-tabs/index.html");
    await expect(page.locator("h1")).toHaveText("Chart");

    const boxes = await page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return {
        bar: box(".TabsBar"),
        tabs: box(".BarTabs"),
        expand: box(".TabsBar > .Toggle"),
        end: box(".TabsBarEnd"),
      };
    });
    expect(boxes.end.right).toBeLessThanOrEqual(375);
    expect(boxes.tabs.top).toBeGreaterThanOrEqual(boxes.expand.bottom);
    expect(boxes.tabs.top).toBeGreaterThanOrEqual(boxes.end.bottom);
    expect(boxes.tabs.width).toBeCloseTo(boxes.bar.width - 32, 0);
    await expect(
      page.getByRole("button", { name: /Switch to (dark|light) mode/ }),
    ).toBeInViewport({ ratio: 1 });

    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.locator("h1")).toHaveText("Settings");
  });
});

test.describe("SidebarLayout right sidebar", () => {
  const boxes = (page: Page) =>
    page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return {
        left: box(".SidebarRail"),
        main: box(".Main"),
        right: box(".SidebarRail--right"),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
  // Polls, since the rails animate to their new place.
  const expectBoxes = (page: Page) => expect.poll(() => boxes(page));
  const button = (page: Page, name: string) =>
    page.getByRole("button", { name, exact: true });

  test("sits across the main pane from the left one and collapses to a strip", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto("./demos/sidebar-right/index.html");
    await expect(page.locator("h1")).toHaveText("Two Sidebars Demo");
    await expectBoxes(page).toMatchObject({
      left: { x: 0, width: 400 },
      main: { x: 400, width: 720 },
      right: { x: 1120, width: 320 },
    });

    await button(page, "Collapse right sidebar").click();
    await expectBoxes(page).toMatchObject({
      left: { x: 0, width: 400 },
      main: { x: 400, width: 1000 },
      right: { x: 1400, width: 40 },
    });
    await expect(page.getByText("Estimated infections")).not.toBeInViewport();

    // Too narrow for both: the open left sidebar keeps its place.
    await button(page, "Expand right sidebar").click();
    await page.setViewportSize({ width: 1000, height: 600 });
    await expectBoxes(page).toMatchObject({
      left: { x: 0, width: 400 },
      right: { x: 960, width: 40 },
    });
  });

  test("slides over the main pane on a phone without a sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 600 });
    await page.goto("./demos/sidebar-right/index.html");
    await expect(page.locator("h1")).toHaveText("Two Sidebars Demo");
    const closed = {
      main: { x: 0, width: 375 },
      right: { width: 0 },
      documentWidth: 375,
    };
    await expectBoxes(page).toMatchObject(closed);

    await button(page, "Expand right sidebar").click();
    await expectBoxes(page).toMatchObject({
      right: { x: 55, width: 320 },
      documentWidth: 375,
    });
    await expect(page.getByText("Estimated infections")).toBeInViewport({
      ratio: 1,
    });

    await button(page, "Collapse right sidebar").click();
    await expectBoxes(page).toMatchObject(closed);
  });
});

test.describe("SidebarLayout print", () => {
  // Roughly the printable width of a Letter page, which is under the mobile
  // breakpoint: the screen-only mobile rules must not shift the printout.
  test.use({ viewport: { width: 682, height: 900 } });

  function pageCount(pdf: Uint8Array) {
    const text = new TextDecoder("latin1").decode(pdf);
    return text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
  }

  test("the main content unrolls and paginates", async ({ page }) => {
    await page.goto("./demos/sidebar-layout/index.html");
    await expect(page.locator("h1")).toHaveText("SidebarLayout Demo");
    await page.emulateMedia({ media: "print" });

    const layout = page.locator(".SidebarLayout");
    const content = page.locator(".MainContent");
    const metrics = await page.evaluate(() => {
      const box = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          x: rect.x,
          height: rect.height,
          transform: style.transform,
          display: style.display,
        };
      };
      return {
        layout: box(".SidebarLayout"),
        content: box(".MainContent"),
        rail: box(".SidebarRail"),
        document: document.documentElement.scrollHeight,
        viewport: window.innerHeight,
      };
    });
    expect(metrics.layout.x).toBe(0);
    expect(metrics.content.x).toBe(0);
    expect(metrics.layout.transform).toBe("none");
    expect(metrics.content.transform).toBe("none");
    expect(metrics.rail.display).toBe("none");
    // The layout is as tall as its content, not the viewport (the content's
    // outer heading margins collapse through the panes, so a little taller).
    expect(metrics.content.height).toBeGreaterThan(metrics.viewport);
    expect(metrics.layout.height).toBeGreaterThanOrEqual(
      metrics.content.height,
    );
    expect(metrics.document).toBeCloseTo(metrics.layout.height, 0);
    await expect(layout).toBeVisible();
    await expect(content).toBeVisible();

    const pdf = await page.pdf({ format: "Letter" });
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  test("the tabs bar is hidden", async ({ page }) => {
    await page.goto("./demos/sidebar-tabs/index.html");
    await expect(page.locator("h1")).toHaveText("Chart");
    await page.emulateMedia({ media: "print" });

    const display = await page.evaluate(() => ({
      rail: getComputedStyle(document.querySelector(".SidebarRail")!).display,
      tabsBar: getComputedStyle(document.querySelector(".TabsBar")!).display,
      layout: getComputedStyle(document.querySelector(".SidebarLayout")!)
        .display,
    }));
    expect(display.rail).toBe("none");
    expect(display.tabsBar).toBe("none");
    expect(display.layout).toBe("block");
    expect(await page.locator(".SidebarLayout").boundingBox()).toMatchObject({
      x: 0,
    });
  });

  test("dark mode prints in the light scheme", async ({ page }) => {
    await page.goto("./demos/sidebar-layout/index.html");
    await expect(page.locator("h1")).toHaveText("SidebarLayout Demo");
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    const onScreen = await page.evaluate(
      () => getComputedStyle(document.querySelector(".MainContent")!).color,
    );
    expect(onScreen).toBe("rgb(248, 249, 250)");

    await page.emulateMedia({ media: "print" });
    const printed = await page.evaluate(() => ({
      scheme: getComputedStyle(document.documentElement).colorScheme,
      color: getComputedStyle(document.querySelector(".MainContent")!).color,
      background: getComputedStyle(document.querySelector(".SidebarLayout")!)
        .backgroundColor,
    }));
    expect(printed.scheme).toBe("light");
    expect(printed.color).toBe("rgb(33, 37, 41)");
    expect(printed.background).toBe("rgb(255, 255, 255)");
  });
});
