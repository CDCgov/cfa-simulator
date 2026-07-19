import { test, expect } from "@playwright/test";
import { execSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(ROOT, "target/debug/cfasim");

type Template = "python" | "rust" | "ixa";

const TMP_DIR = mkdtempSync(resolve(tmpdir(), "cfasim-test-"));

function cleanProject(name: string) {
  const dir = resolve(TMP_DIR, name);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function scaffoldProject(name: string, template: Template) {
  cleanProject(name);
  const dir = resolve(TMP_DIR, name);
  // CFASIM_LOCAL_UI_DIR makes the scaffolded project's pnpm-workspace.yaml add
  // `overrides` linking the local working-tree cfasim-ui packages, so these
  // tests exercise the current source instead of whatever is on npm.
  execSync(`${CLI} init --dir ${dir} --template ${template} --local`, {
    env: { ...process.env, CFASIM_LOCAL_UI_DIR: ROOT },
  });
}

function startVite(
  name: string,
  port: number,
): { proc: ChildProcess; url: string } {
  const proc = spawn(
    "pnpm",
    ["exec", "vite", "--port", String(port), "--strictPort"],
    {
      cwd: resolve(TMP_DIR, name),
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  return { proc, url: `http://localhost:${port}` };
}

async function waitForServer(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

test.describe("cfasim init", () => {
  const projects: {
    name: string;
    template: Template;
    port: number;
    paramLabel: string;
  }[] = [
    {
      name: "test-project-python",
      template: "python",
      port: 7201,
      paramLabel: "Steps",
    },
    {
      name: "test-project-rust",
      template: "rust",
      port: 7202,
      paramLabel: "Steps",
    },
    {
      name: "test-project-ixa",
      template: "ixa",
      port: 7203,
      paramLabel: "Population",
    },
  ];

  const procs: ChildProcess[] = [];

  test.beforeAll(async () => {
    // Build CLI
    execSync("cargo build -p cfasim", { cwd: ROOT });

    // Build the cfasim-ui packages whose `dist` is consumed via the local
    // `file:` links injected by CFASIM_LOCAL_UI_DIR (see scaffoldProject); the
    // rest of the packages ship their `src` directly.
    execSync(
      "pnpm --filter @cfasim-ui/components --filter @cfasim-ui/charts run build",
      { cwd: ROOT, stdio: "pipe" },
    );

    // Generate the bundled package docs. `file:` directory links don't run
    // prepack, so the docs/ dirs must exist on disk before `pnpm install`
    // copies the packages (exercised by the `cfasim docs` test below).
    execSync("node scripts/generate_docs.mjs", { cwd: ROOT, stdio: "pipe" });

    // Scaffold and install each project
    for (const p of projects) {
      scaffoldProject(p.name, p.template);
      execSync("pnpm install", { cwd: resolve(TMP_DIR, p.name) });
    }

    // Pre-build wasm so `waitForServer` doesn't time out waiting on the
    // `cfasimWasm` plugin's cold cargo build during vite startup. Mirrors
    // the plugin's invocation in cfasim-ui/wasm/src/vitePlugin.js.
    for (const p of projects) {
      if (p.template === "python") continue; // pyodide template, no wasm-pack
      const moduleName = p.name.replace(/-/g, "_");
      execSync(
        `wasm-pack build .. --target web --out-dir public/wasm/${moduleName}`,
        { cwd: resolve(TMP_DIR, p.name, "interactive"), stdio: "pipe" },
      );
    }

    // Start vite dev servers
    for (const p of projects) {
      const { proc, url } = startVite(p.name, p.port);
      procs.push(proc);
      await waitForServer(url);
    }
  });

  test.afterAll(async () => {
    for (const proc of procs) {
      proc.kill();
    }
    // Wait for child processes to exit before removing temp dir
    await new Promise((r) => setTimeout(r, 1000));
    try {
      rmSync(TMP_DIR, { recursive: true, force: true });
    } catch {
      // Retry once after additional delay (macOS race condition)
      await new Promise((r) => setTimeout(r, 1000));
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  test("scaffolded project resolves cfasim docs", () => {
    // Scaffolded projects depend only on the cfasim-ui umbrella, so the CLI
    // must find the bundled docs through pnpm's virtual store.
    const raw = execSync(`${CLI} docs --json`, {
      cwd: resolve(TMP_DIR, projects[0].name),
    }).toString();
    const parsed = JSON.parse(raw);
    expect(parsed.content.components.length).toBeGreaterThan(0);
    expect(parsed.content.charts.length).toBeGreaterThan(0);
    expect(existsSync(parsed.content.components[0].docs)).toBe(true);
    expect(existsSync(parsed.content.components[0].source)).toBe(true);
  });

  for (const p of projects) {
    test(`${p.template} project typechecks`, () => {
      execSync("pnpm run typecheck", {
        cwd: resolve(TMP_DIR, p.name),
        stdio: "pipe",
      });
    });

    test(`${p.template} project renders`, async ({ page }) => {
      await page.goto(`http://localhost:${p.port}`);

      await expect(page.locator("h2")).toContainText(p.name);
      await expect(page.locator("h1")).toContainText(p.name);
      await expect(page.getByLabel(p.paramLabel)).toBeVisible();

      // Verify the model actually loaded and drew the chart.
      await expect(page.locator("svg path").first()).toBeVisible({
        timeout: 30_000,
      });
    });

    test(`${p.template} project loads no icon webfont`, async ({ page }) => {
      // Icons are inline SVGs now, so a scaffolded app must never fetch the
      // Material Symbols webfont (the template dropped its <link>).
      const fontRequests: string[] = [];
      page.on("request", (req) => {
        const url = req.url();
        if (
          /fonts\.(googleapis|gstatic)\.com/.test(url) ||
          /Material[+ ]?Symbols/i.test(url)
        ) {
          fontRequests.push(url);
        }
      });

      await page.goto(`http://localhost:${p.port}`);
      await expect(page.locator("svg path").first()).toBeVisible({
        timeout: 30_000,
      });

      expect(fontRequests).toEqual([]);
    });
  }
});
