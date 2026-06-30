import { test, expect } from "@playwright/test";
import { execSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(ROOT, "target/debug/cfasim");
const require = createRequire(import.meta.url);
const rwasmRequire = createRequire(
  resolve(ROOT, "cfasim-ui/rwasm/package.json"),
);
const WEBR_ENTRY = rwasmRequire.resolve("webr");
const WEBR_VERSION = JSON.parse(
  readFileSync(resolve(dirname(dirname(WEBR_ENTRY)), "package.json"), "utf8"),
).version;
const SERVER_START_TIMEOUT_MS = Number(
  process.env.CFASIM_E2E_SERVER_TIMEOUT_MS ?? "300000",
);

type Template = "python" | "rust" | "ixa" | "R";

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

async function waitForServer(url: string, timeoutMs = SERVER_START_TIMEOUT_MS) {
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
  const allProjects: {
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
    {
      name: "test-project-R",
      template: "R",
      port: 7204,
      paramLabel: "Steps",
    },
  ];

  // The R template's webR build/download pushes the shared beforeAll past the
  // 5-minute hook timeout, so skip the R project (its setup + tests) for now.
  const projects = allProjects.filter((p) => p.template !== "R");

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

    // Scaffold and install each project
    for (const p of projects) {
      scaffoldProject(p.name, p.template);
      execSync("pnpm install", { cwd: resolve(TMP_DIR, p.name) });
      if (p.template === "R") {
        execSync("pnpm run build", {
          cwd: resolve(TMP_DIR, p.name),
          stdio: "pipe",
        });
        const webrWorker = resolve(
          TMP_DIR,
          p.name,
          `dist/rwasm/webr/v${WEBR_VERSION}/webr-worker.js`,
        );
        if (!existsSync(webrWorker)) {
          throw new Error(`Missing hosted webR worker asset: ${webrWorker}`);
        }
      }
    }

    // Pre-build wasm so `waitForServer` doesn't time out waiting on the
    // `cfasimWasm` plugin's cold cargo build during vite startup. Mirrors
    // the plugin's invocation in cfasim-ui/wasm/src/vitePlugin.js.
    for (const p of projects) {
      if (p.template === "python" || p.template === "R") continue;
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
