import { test, expect } from "@playwright/test";
import { execSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, rmSync, mkdtempSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(ROOT, "target/debug/cfasim");

type Template = "python" | "rust";

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
  execSync(`${CLI} init --dir ${dir} --template ${template} --local`);
}

function uiDir(name: string) {
  return resolve(TMP_DIR, name, "interactive");
}

function startVite(
  name: string,
  port: number,
): { proc: ChildProcess; url: string } {
  const proc = spawn(
    "pnpm",
    ["exec", "vite", "--port", String(port), "--strictPort"],
    {
      cwd: uiDir(name),
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
  const projects: { name: string; template: Template; port: number }[] = [
    { name: "test-project-python", template: "python", port: 7201 },
    { name: "test-project-rust", template: "rust", port: 7202 },
  ];

  const procs: ChildProcess[] = [];

  // During release prep the workspace version has been bumped but not yet
  // published to npm. Scaffolded projects would fail `pnpm install` in that
  // window — skip the suite until the bump lands on the registry.
  const uiVersion = JSON.parse(
    readFileSync(resolve(ROOT, "cfasim-ui/cfasim-ui/package.json"), "utf8"),
  ).version;
  let published = false;
  try {
    const out = execSync(`npm view cfasim-ui@${uiVersion} version`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    published = out.length > 0;
  } catch {
    published = false;
  }

  test.beforeAll(async () => {
    test.skip(
      !published,
      `cfasim-ui@${uiVersion} is not published to npm yet. Skipping until release lands`,
    );
    // Build CLI
    execSync("cargo build -p cfasim", { cwd: ROOT });

    // Scaffold and install each project
    for (const p of projects) {
      scaffoldProject(p.name, p.template);
      execSync("pnpm install", { cwd: uiDir(p.name) });
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
    test(`${p.template} project renders`, async ({ page }) => {
      await page.goto(`http://localhost:${p.port}`);

      await expect(page.locator("h2")).toContainText(p.name);
      await expect(page.locator("h1")).toContainText(p.name);
      await expect(page.getByLabel("Steps")).toBeVisible();

      // Verify the model actually loaded and produced output.
      await expect(page.locator("ul li").first()).toContainText("t=", {
        timeout: 20_000,
      });
    });
  }
});
