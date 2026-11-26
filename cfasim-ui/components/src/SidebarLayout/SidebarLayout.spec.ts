import { test, expect, type Page } from "@playwright/test";

test.describe("SidebarLayout full-window demo", () => {
  test.use({ viewport: { width: 900, height: 480 } });

  test("the document never scrolls, only the panes do", async ({ page }) => {
    await page.goto("./demos/sidebar-layout/index.html");
    await expect(page.locator("h1")).toHaveText("SidebarLayout Demo");

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
  });
});

test.describe("SidebarLayout sidebar on a small phone", () => {
  test.use({ viewport: { width: 360, height: 600 } });

  test("open sidebar fits screen and Tab focusin into main collapses it", async ({
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

test.describe("SidebarLayout right sidebar", () => {
  const boxes = (page: Page) =>
    page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON();
      return {
        left: box(".SidebarRail"),
        main: box(".Main"),
        right: box(".SidebarRail--right"),
      };
    });
  const expectBoxes = (page: Page) => expect.poll(() => boxes(page));

  test("sits across the main pane and collapses below 1200px", async ({
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

    await page.setViewportSize({ width: 1000, height: 600 });
    await expectBoxes(page).toMatchObject({
      left: { x: 0, width: 400 },
      right: { x: 960, width: 40 },
    });
  });
});

test.describe("SidebarLayout print", () => {
  // Under the mobile breakpoint: screen-only mobile rules must not shift print.
  test.use({ viewport: { width: 682, height: 900 } });

  function pageCount(pdf: Uint8Array) {
    const text = new TextDecoder("latin1").decode(pdf);
    return text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
  }

  test("the main content unrolls and paginates", async ({ page }) => {
    await page.goto("./demos/sidebar-layout/index.html");
    await expect(page.locator("h1")).toHaveText("SidebarLayout Demo");
    await page.emulateMedia({ media: "print" });

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
        viewport: window.innerHeight,
      };
    });
    expect(metrics.layout.x).toBe(0);
    expect(metrics.content.x).toBe(0);
    expect(metrics.layout.transform).toBe("none");
    expect(metrics.rail.display).toBe("none");
    expect(metrics.content.height).toBeGreaterThan(metrics.viewport);

    const pdf = await page.pdf({ format: "Letter" });
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  test("dark mode prints in the light scheme", async ({ page }) => {
    await page.goto("./demos/sidebar-layout/index.html");
    await expect(page.locator("h1")).toHaveText("SidebarLayout Demo");
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });

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
