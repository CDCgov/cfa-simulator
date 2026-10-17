import { test, expect } from "@playwright/test";
import { exec, execSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(ROOT, "target/debug/cfasim");

type Template = "python" | "python-server" | "rust" | "rust-server" | "ixa";

const TMP_DIR = mkdtempSync(resolve(tmpdir(), "cfasim-test-"));

function cleanProject(name: string) {
  const dir = resolve(TMP_DIR, name);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function scaffoldProject(
  name: string,
  template: Template,
  serverPort?: number,
) {
  cleanProject(name);
  const dir = resolve(TMP_DIR, name);
  // CFASIM_LOCAL_UI_DIR makes the scaffolded project's pnpm-workspace.yaml add
  // `overrides` linking the local working-tree cfasim-ui packages, so these
  // tests exercise the current source instead of whatever is on npm.
  execSync(`${CLI} init --dir ${dir} --template ${template} --local`, {
    env: { ...process.env, CFASIM_LOCAL_UI_DIR: ROOT },
  });
  // Every server template starts `cfasim serve` on 8765; two of them running
  // at once need their own ports or the pages silently share one server.
  if (serverPort !== undefined) {
    const config = resolve(dir, "vite.config.ts");
    const text = readFileSync(config, "utf8");
    if (!text.includes("cfasimServer()")) {
      throw new Error(`expected cfasimServer() in ${config}`);
    }
    writeFileSync(
      config,
      text.replace("cfasimServer()", `cfasimServer({ port: ${serverPort} })`),
    );
  }
}

// Each template keeps a persistent cargo target dir under the (gitignored)
// workspace `target/` so dependency crates compile once, not per run; one
// dir per template because cargo locks a target dir per build. Both the
// pre-build below and the `cfasimWasm` vite plugin (which runs wasm-pack
// again at startup) must point at it.
function wasmEnv(template: Template) {
  return {
    ...process.env,
    CARGO_TARGET_DIR: resolve(ROOT, "target/e2e-wasm", template),
    // The server templates' vite plugin starts `cfasim serve`: use the CLI
    // built from this tree, not whatever is on PATH (or uvx would fetch).
    CFASIM_BIN: CLI,
  };
}

function startVite(
  name: string,
  template: Template,
  port: number,
): { proc: ChildProcess; url: string } {
  const proc = spawn(
    "pnpm",
    ["exec", "vite", "--port", String(port), "--strictPort"],
    {
      cwd: resolve(TMP_DIR, name),
      env: wasmEnv(template),
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
    // Port for the project's own `cfasim serve` (default 8765).
    serverPort?: number;
  }[] = [
    {
      name: "test-project-python",
      template: "python",
      port: 7201,
      paramLabel: "Steps",
    },
    {
      name: "test-project-python-server",
      template: "python-server",
      port: 7204,
      paramLabel: "Steps",
    },
    {
      name: "test-project-rust",
      template: "rust",
      port: 7202,
      paramLabel: "Steps",
    },
    {
      name: "test-project-rust-server",
      template: "rust-server",
      port: 7205,
      paramLabel: "Steps",
      serverPort: 8766,
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

    // Scaffold and install each project. Installs are independent, so run
    // them concurrently.
    for (const p of projects) {
      scaffoldProject(p.name, p.template, p.serverPort);
    }
    await Promise.all(
      projects.flatMap((p) => {
        const cwd = resolve(TMP_DIR, p.name);
        const steps = [execAsync("pnpm install", { cwd })];
        // The Python server template's worker runs under uv; sync its venv
        // up front so vite startup is not blocked on a cold resolve.
        if (p.template === "python-server") {
          steps.push(execAsync("uv sync", { cwd }));
        }
        // `cfasim serve` builds the Rust tasks binary at startup; build it
        // up front (same target dir) so `waitForServer` is not racing cargo.
        if (p.template === "rust-server") {
          steps.push(
            execAsync("cargo build --release", {
              cwd,
              env: wasmEnv(p.template),
            }),
          );
        }
        return steps;
      }),
    );

    // Pre-build wasm so `waitForServer` doesn't time out waiting on the
    // `cfasimWasm` plugin's cold cargo build during vite startup. Mirrors
    // the plugin's invocation in cfasim-ui/wasm/src/vitePlugin.js.
    await Promise.all(
      projects
        .filter((p) => p.template === "rust" || p.template === "ixa") // wasm templates only
        .map((p) => {
          const moduleName = p.name.replace(/-/g, "_");
          return execAsync(
            `wasm-pack build .. --target web --out-dir public/wasm/${moduleName}`,
            {
              cwd: resolve(TMP_DIR, p.name, "interactive"),
              env: wasmEnv(p.template),
            },
          );
        }),
    );

    // Start vite dev servers
    const servers = projects.map((p) => startVite(p.name, p.template, p.port));
    procs.push(...servers.map((s) => s.proc));
    await Promise.all(servers.map((s) => waitForServer(s.url)));
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

    // The server templates draw their chart only after a run is started.
    const clickRun = p.template.endsWith("-server");

    test(`${p.template} project renders`, async ({ page }) => {
      await page.goto(`http://localhost:${p.port}`);

      await expect(page.locator("h2")).toContainText(p.name);
      await expect(page.locator("h1")).toContainText(p.name);
      await expect(page.getByLabel(p.paramLabel)).toBeVisible();

      if (clickRun) {
        await page.getByRole("button", { name: "Run", exact: true }).click();
      }

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
      if (clickRun) {
        await page.getByRole("button", { name: "Run", exact: true }).click();
      }
      await expect(page.locator("svg path").first()).toBeVisible({
        timeout: 30_000,
      });

      expect(fontRequests).toEqual([]);
    });
  }
});
